import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  notifyPaymentReleased,
  notifyPayoutClaimReady,
  notifyReviewRequestsForJob,
} from "@/lib/notifications";
import {
  createOnboardingLink,
  fireTransfer,
  getOrCreateStripeAccount,
} from "@/lib/stripe-connect";

/**
 * Returns true if `days` working days (Mon–Fri) have passed since `from`.
 */
function workingDaysPassed(from: Date, days: number): boolean {
  let counted = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1); // start counting from the day AFTER

  while (counted < days) {
    const dow = cursor.getDay(); // 0 = Sun, 6 = Sat
    if (dow !== 0 && dow !== 6) counted++;
    if (counted < days) cursor.setDate(cursor.getDate() + 1);
  }

  return new Date() >= cursor;
}

// GET /api/cron/auto-release
// Called by scheduled cron workers (or manually for testing).
// Secured via CRON_SECRET env var checked against Authorization header.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("CRON_SECRET is not set in production");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }
    // Dev only: allow unauthenticated access when secret is not set
  } else {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    }
  }

  const supabase = await createClient();

  // Find all jobs where kinglancer has marked work done (status = 'completed')
  // and there is a held transaction (payment is waiting)
  const { data: completedJobs, error } = await supabase
    .from("jobs")
    .select("id, title, updated_at, client_id, kinglancer_id")
    .eq("status", "completed");

  if (error) {
    console.error("auto-release: failed to fetch jobs", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const toRelease = (completedJobs ?? []).filter((job) =>
    workingDaysPassed(new Date(job.updated_at), 5),
  );

  if (toRelease.length === 0) {
    return NextResponse.json({ released: 0, message: "Nothing to release" });
  }

  let released = 0;
  const errors: string[] = [];
  const serviceClient = createServiceClient();

  for (const job of toRelease) {
    // 1. Fetch the held transaction. If the kinglancer is already onboarded,
    // we transfer before marking it released so the DB/user-facing state only
    // advances after Stripe accepts the payout.
    const { data: txData, error: txError } = await serviceClient
      .from("transactions")
      .select("id, amount, platform_fee_kinglancer, stripe_payment_intent_id")
      .eq("job_id", job.id)
      .eq("status", "held")
      .single();

    if (txError || !txData) {
      errors.push(`job ${job.id}: ${txError?.message ?? "tx not found"}`);
      continue;
    }

    const netAmount = txData.amount - txData.platform_fee_kinglancer;
    let profile: {
      email: string | null;
      full_name: string | null;
      stripe_account_id: string | null;
      stripe_onboarding_complete: boolean;
    } | null = null;

    if (job.kinglancer_id) {
      const { data } = await serviceClient
        .from("profiles")
        .select(
          "email, full_name, stripe_account_id, stripe_onboarding_complete",
        )
        .eq("id", job.kinglancer_id)
        .single();
      profile = data;

      if (profile?.stripe_onboarding_complete && profile.stripe_account_id) {
        try {
          await fireTransfer({
            transactionId: txData.id,
            amountPence: Math.round(netAmount * 100),
            destinationAccountId: profile.stripe_account_id,
            jobId: job.id,
            paymentIntentId: txData.stripe_payment_intent_id ?? undefined,
          });
        } catch (err) {
          errors.push(`job ${job.id}: Stripe transfer failed`);
          console.error(
            `auto-release: Stripe transfer failed for job ${job.id}:`,
            err,
          );
          continue;
        }
      }
    }

    // 2. Release the transaction and advance job status after any required
    // Stripe transfer has succeeded.
    const releasedAt = new Date().toISOString();
    const { error: releaseError } = await serviceClient
      .from("transactions")
      .update({
        status: "released",
        released_at: releasedAt,
      })
      .eq("id", txData.id)
      .eq("status", "held")
      .select("id")
      .single();

    if (releaseError) {
      errors.push(`job ${job.id}: ${releaseError.message}`);
      continue;
    }

    const { error: jobError } = await serviceClient
      .from("jobs")
      .update({ status: "approved" })
      .eq("id", job.id);

    if (jobError) {
      errors.push(`job ${job.id}: ${jobError.message}`);
      continue;
    }

    released++;

    // Both parties can now review each other (double-blind, 7-day window).
    notifyReviewRequestsForJob(job.id, job.title).catch(() => {});

    // 3. Mirror manual approval side effects after the release is committed.
    if (job.kinglancer_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (serviceClient as any)
        .rpc("increment_jobs_completed", { user_id: job.kinglancer_id })
        .then(() => null);

      if (profile?.email) {
        const kinglancerEmail = profile.email;

        if (profile.stripe_onboarding_complete && profile.stripe_account_id) {
          notifyPaymentReleased({
            kinglancerId: job.kinglancer_id,
            kinglancerEmail,
            jobTitle: job.title,
            amount: netAmount,
          }).catch(() => {});
        } else {
          getOrCreateStripeAccount(
            job.kinglancer_id,
            kinglancerEmail,
            profile.stripe_account_id,
            profile.full_name ?? undefined,
          )
            .then((accountId) => createOnboardingLink(accountId))
            .then((onboardingUrl) =>
              notifyPayoutClaimReady({
                kinglancerId: job.kinglancer_id!,
                kinglancerEmail,
                jobTitle: job.title,
                amount: netAmount,
                onboardingUrl,
              }),
            )
            .catch((err) =>
              console.error(
                `auto-release: payout claim notification failed for job ${job.id}:`,
                err,
              ),
            );
        }
      }
    }
  }

  console.log(
    `auto-release: released ${released}/${toRelease.length} transactions`,
    errors.length ? { errors } : "",
  );

  // ── Retry released-but-untransferred ────────────────────────────────────
  // Handles the case where fireTransfer failed on a previous auto-release or
  // approve run for an already-onboarded kinglancer. We attempt the transfer
  // again; fireTransfer is idempotent via its DB pre-check and Stripe
  // idempotency key so duplicate calls are safe.
  const { data: unTransferred } = await serviceClient
    .from("transactions")
    .select(
      "id, job_id, amount, platform_fee_kinglancer, stripe_payment_intent_id, kinglancer_id",
    )
    .eq("status", "released")
    .is("stripe_transfer_id", null);

  for (const tx of unTransferred ?? []) {
    if (!tx.kinglancer_id) continue;
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", tx.kinglancer_id)
      .single();

    if (profile?.stripe_onboarding_complete && profile.stripe_account_id) {
      await fireTransfer({
        transactionId: tx.id,
        amountPence: Math.round((tx.amount - tx.platform_fee_kinglancer) * 100),
        destinationAccountId: profile.stripe_account_id,
        jobId: tx.job_id,
        paymentIntentId: tx.stripe_payment_intent_id ?? undefined,
      }).catch((err) =>
        console.error(
          `auto-release: retry transfer failed for tx ${tx.id}:`,
          err,
        ),
      );
    }
  }

  // Invalidate all kinglancer profile caches — jobs_completed changed for
  // every kinglancer whose payment was just released.
  if (released > 0) {
    revalidateTag("kinglancer-profiles", { expire: 0 });
  }

  return NextResponse.json({
    released,
    total: toRelease.length,
    errors: errors.length ? errors : undefined,
  });
}
