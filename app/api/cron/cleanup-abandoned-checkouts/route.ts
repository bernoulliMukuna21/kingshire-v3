import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";

// GET /api/cron/cleanup-abandoned-checkouts
// Finds transactions stuck in "pending" for more than 1 hour (client opened
// the payment page but never completed it) and rolls back the job so other
// kinglancers can still be considered.
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

  // Find pending transactions older than 15 minutes
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stuckTxns, error } = await db
    .from("transactions")
    .select("id, job_id, stripe_payment_intent_id, kinglancer_id")
    .eq("status", "pending")
    .lt("created_at", cutoff);

  if (error) {
    console.error("[cleanup-abandoned-checkouts] query error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!stuckTxns?.length) {
    return NextResponse.json({ cleaned: 0 });
  }

  let cleaned = 0;
  for (const txn of stuckTxns) {
    try {
      // If there is a PaymentIntent, check its status before doing anything.
      // A PI can succeed between our cutoff query and now (delayed webhook),
      // so we must only clean up if it is in a safely-cancellable state.
      if (txn.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(
          txn.stripe_payment_intent_id,
        );

        if (pi.status === "canceled") {
          // Stripe already auto-cancelled it (e.g. after 24 h with no payment
          // method attached). Safe to clean up the DB — no need to call cancel.
        } else if (
          [
            "requires_payment_method",
            "requires_confirmation",
            "requires_action",
          ].includes(pi.status)
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
            // Cancel failed for an unexpected reason — skip to avoid data inconsistency
            continue;
          }
        } else {
          // succeeded / processing — the webhook will handle cleanup.
          console.warn(
            `[cleanup-abandoned-checkouts] PI ${txn.stripe_payment_intent_id} has status "${pi.status}", skipping txn ${txn.id}`,
          );
          continue;
        }
      }

      // Delete the pending transaction row
      await db.from("transactions").delete().eq("id", txn.id);

      // Reset the job to open and clear the assigned kinglancer
      await db
        .from("jobs")
        .update({ status: "open", kinglancer_id: null })
        .eq("id", txn.job_id)
        .eq("status", "in_progress"); // only reset if still in_progress

      // Reset accepted/rejected applications back to pending. selectApplicant()
      // rejects other pending applicants before payment succeeds.
      await db
        .from("applications")
        .update({ status: "pending" })
        .eq("job_id", txn.job_id)
        .in("status", ["accepted", "rejected"]);

      cleaned++;
    } catch (err) {
      console.error(
        `[cleanup-abandoned-checkouts] Failed to clean txn ${txn.id}:`,
        err,
      );
    }
  }

  console.log(
    `[cleanup-abandoned-checkouts] Cleaned ${cleaned} abandoned checkouts`,
  );
  return NextResponse.json({ cleaned });
}
