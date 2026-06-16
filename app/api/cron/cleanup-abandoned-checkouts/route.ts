import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import {
  finalizePaymentAttempt,
  isCancellablePaymentIntentStatus,
  updatePaymentAttemptStatus,
} from "@/lib/db/payment-attempts";

// GET /api/cron/cleanup-abandoned-checkouts
// Finds payment attempts stuck in "pending" after the client opened the
// payment page but never completed it.
// Secured via the same CRON_SECRET as auto-release.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    // Dev: allow without auth when secret is not configured
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const db = createServiceClient();

  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: stuckAttempts, error: attemptsError } = await db
    .from("payment_attempts")
    .select("id, job_id, stripe_payment_intent_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (attemptsError) {
    console.error(
      "[cleanup-abandoned-checkouts] payment attempts query error:",
      attemptsError,
    );
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  let cleanedAttempts = 0;
  for (const attempt of stuckAttempts ?? []) {
    try {
      let piStatus: string | null = null;
      try {
        const pi = await stripe.paymentIntents.retrieve(
          attempt.stripe_payment_intent_id,
        );
        piStatus = pi.status;
      } catch (stripeErr: unknown) {
        const code = (stripeErr as { code?: string })?.code;
        if (code === "resource_missing") {
          piStatus = "not_found";
        } else {
          throw stripeErr;
        }
      }

      if (piStatus === "succeeded") {
        await finalizePaymentAttempt(attempt.stripe_payment_intent_id);
        cleanedAttempts++;
        continue;
      }

      if (piStatus === "processing") {
        console.warn(
          `[cleanup-abandoned-checkouts] PI ${attempt.stripe_payment_intent_id} is processing; skipping attempt ${attempt.id}`,
        );
        continue;
      }

      if (isCancellablePaymentIntentStatus(piStatus ?? "")) {
        await stripe.paymentIntents.cancel(attempt.stripe_payment_intent_id);
        await updatePaymentAttemptStatus(
          attempt.stripe_payment_intent_id,
          "expired",
        );
        cleanedAttempts++;
        continue;
      }

      if (piStatus === "canceled" || piStatus === "not_found") {
        await updatePaymentAttemptStatus(
          attempt.stripe_payment_intent_id,
          "expired",
        );
        cleanedAttempts++;
      }
    } catch (err) {
      console.error(
        `[cleanup-abandoned-checkouts] Failed to clean payment attempt ${attempt.id}:`,
        err,
      );
    }
  }

  // Legacy cleanup for pending transaction rows created before payment_attempts
  // existed. New flows do not create transactions until payment succeeds.
  const { data: stuckTxns, error } = await db
    .from("transactions")
    .select("id, job_id, stripe_payment_intent_id, kinglancer_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[cleanup-abandoned-checkouts] query error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!stuckAttempts?.length && !stuckTxns?.length) {
    console.log(
      "[cleanup-abandoned-checkouts] No pending attempts or transactions found older than cutoff:",
      cutoff,
    );
    return NextResponse.json({
      cleaned: 0,
      attempts: 0,
      legacyTransactions: 0,
    });
  }

  if (stuckTxns?.length) {
    console.log(
      `[cleanup-abandoned-checkouts] Found ${stuckTxns.length} legacy pending txn(s):`,
      stuckTxns.map((t) => ({
        id: t.id,
        pi: t.stripe_payment_intent_id,
        job_id: t.job_id,
      })),
    );
  }

  let cleaned = 0;
  for (const txn of stuckTxns) {
    try {
      // If there is a PaymentIntent, check its status before doing anything.
      // A PI can succeed between our cutoff query and now (delayed webhook),
      // so we must only clean up if it is in a safely-cancellable state.
      if (txn.stripe_payment_intent_id) {
        let piStatus: string | null = null;
        try {
          const pi = await stripe.paymentIntents.retrieve(
            txn.stripe_payment_intent_id,
          );
          piStatus = pi.status;
        } catch (stripeErr: unknown) {
          const code = (stripeErr as { code?: string })?.code;
          if (code === "resource_missing") {
            // PI doesn't exist in the current Stripe account (e.g. key mismatch,
            // or PI was created in a different test environment). Safe to clean up DB.
            console.warn(
              `[cleanup-abandoned-checkouts] PI ${txn.stripe_payment_intent_id} not found in Stripe — cleaning up DB only`,
            );
            piStatus = "not_found";
          } else {
            throw stripeErr;
          }
        }

        console.log(
          `[cleanup-abandoned-checkouts] PI ${txn.stripe_payment_intent_id} status: "${piStatus}"`,
        );

        if (piStatus === "canceled" || piStatus === "not_found") {
          // Already gone from Stripe — just clean the DB
        } else if (
          [
            "requires_payment_method",
            "requires_confirmation",
            "requires_action",
          ].includes(piStatus!)
        ) {
          // Safe to cancel on Stripe then clean up DB
          try {
            await stripe.paymentIntents.cancel(txn.stripe_payment_intent_id);
          } catch (stripeErr: unknown) {
            const msg =
              stripeErr instanceof Error
                ? stripeErr.message
                : String(stripeErr);
            console.warn(
              `[cleanup-abandoned-checkouts] Could not cancel PI ${txn.stripe_payment_intent_id}: ${msg}`,
            );
            continue;
          }
        } else {
          // succeeded / processing — the webhook will handle cleanup.
          console.warn(
            `[cleanup-abandoned-checkouts] PI ${txn.stripe_payment_intent_id} has status "${piStatus}", skipping txn ${txn.id}`,
          );
          continue;
        }
      }

      // Delete the pending transaction row
      const { error: delError } = await db
        .from("transactions")
        .delete()
        .eq("id", txn.id);
      console.log(
        `[cleanup-abandoned-checkouts] Deleted txn ${txn.id}:`,
        delError ?? "ok",
      );

      // Reset the job to open and clear the assigned kinglancer
      const { error: jobError } = await db
        .from("jobs")
        .update({ status: "open", kinglancer_id: null })
        .eq("id", txn.job_id)
        .eq("status", "in_progress"); // only reset if still in_progress
      console.log(
        `[cleanup-abandoned-checkouts] Reset job ${txn.job_id}:`,
        jobError ?? "ok",
      );

      // Reset accepted/rejected applications back to pending. selectApplicant()
      // rejects other pending applicants before payment succeeds.
      const appsResult = await db
        .from("applications")
        .update({ status: "pending" })
        .eq("job_id", txn.job_id)
        .in("status", ["accepted", "rejected"]);

      console.log(
        `[cleanup-abandoned-checkouts] Cleaned txn ${txn.id} / job ${txn.job_id}. Apps reset error:`,
        appsResult.error ?? "none",
      );
      cleaned++;
    } catch (err) {
      console.error(
        `[cleanup-abandoned-checkouts] Failed to clean txn ${txn.id}:`,
        err,
      );
    }
  }

  console.log(
    `[cleanup-abandoned-checkouts] Cleaned ${cleanedAttempts} payment attempt(s) and ${cleaned} legacy transaction(s)`,
  );
  return NextResponse.json({
    cleaned: cleanedAttempts + cleaned,
    attempts: cleanedAttempts,
    legacyTransactions: cleaned,
  });
}
