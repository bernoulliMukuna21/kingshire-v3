import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/service";
import { collectPages } from "@/lib/db/pagination";
import { approveJobPayment } from "@/lib/settlement/job-payments";
import { fireTransfer } from "@/lib/stripe-connect";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    (!secret && process.env.NODE_ENV === "production") ||
    (secret && request.headers.get("authorization") !== `Bearer ${secret}`)
  ) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const db = createServiceClient();
  const query = db
    .from("jobs")
    .select("id")
    .eq("status", "completed")
    .lt(
      "updated_at",
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    )
    .order("id");
  const jobs = await collectPages((from, to) => query.range(from, to));
  let released = 0;
  const errors: string[] = [];
  for (const job of jobs) {
    try {
      await approveJobPayment(job.id);
      released++;
    } catch (error) {
      console.error("[auto-release]", job.id, error);
      errors.push(`job ${job.id}: settlement not completed`);
    }
  }
  // Onboarding may finish after approval. All retries still use the shared reservation.
  const pending = db
    .from("transactions")
    .select("id,job_id,amount,platform_fee_kinglancer,kinglancer_id")
    .eq("status", "released")
    .is("stripe_transfer_id", null)
    .is("release_attempt_id", null)
    .or("payout_method.is.null,payout_method.neq.manual")
    .order("id");
  for (const tx of await collectPages((from, to) => pending.range(from, to))) {
    const { data: worker, error } = await db
      .from("profiles")
      .select("stripe_account_id,stripe_onboarding_complete")
      .eq("id", tx.kinglancer_id)
      .single();
    if (
      error ||
      !worker?.stripe_onboarding_complete ||
      !worker.stripe_account_id
    )
      continue;
    try {
      await fireTransfer({
        transactionId: tx.id,
        jobId: tx.job_id,
        amountPence: Math.round(
          (Number(tx.amount) - Number(tx.platform_fee_kinglancer)) * 100,
        ),
        destinationAccountId: worker.stripe_account_id,
      });
    } catch (error) {
      console.error("[auto-release retry]", tx.id, error);
      errors.push(`transaction ${tx.id}: settlement not completed`);
    }
  }
  if (released) revalidateTag("kinglancer-profiles", { expire: 0 });
  return NextResponse.json({
    released,
    total: jobs.length,
    errors: errors.length ? errors : undefined,
  });
}
