import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe } from "@/lib/stripe";
import {
  finalizePaymentAttempt,
  getPendingPaymentAttemptByJob,
  isCancellablePaymentIntentStatus,
  updatePaymentAttemptStatus,
} from "@/lib/db/payment-attempts";
import { canManageJob } from "@/lib/organisations";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const db = createServiceClient();

  const { data: job } = await db
    .from("jobs")
    .select("id, client_id, organisation_id, status")
    .eq("id", jobId)
    .single();

  if (!job || !(await canManageJob(job, user.id)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const attempt = await getPendingPaymentAttemptByJob(jobId);

  if (!attempt) {
    return NextResponse.json(
      { error: "No pending payment to cancel" },
      { status: 404 },
    );
  }

  // Cancel on Stripe if the intent is still cancellable
  try {
    const pi = await stripe.paymentIntents.retrieve(
      attempt.stripe_payment_intent_id,
    );

    if (isCancellablePaymentIntentStatus(pi.status)) {
      await stripe.paymentIntents.cancel(attempt.stripe_payment_intent_id);
    } else if (pi.status === "succeeded") {
      await finalizePaymentAttempt(pi.id);
      return NextResponse.json(
        { error: "Payment already completed for this job" },
        { status: 409 },
      );
    } else if (pi.status === "processing") {
      return NextResponse.json(
        { error: "Payment is still processing and cannot be cancelled yet" },
        { status: 409 },
      );
    }
  } catch (err: unknown) {
    const stripeError = err as { code?: string };
    if (stripeError.code !== "resource_missing") {
      console.error("[cancel-payment] Stripe cancel error:", err);
      return NextResponse.json(
        { error: "Could not cancel payment" },
        { status: 502 },
      );
    }
  }

  await updatePaymentAttemptStatus(
    attempt.stripe_payment_intent_id,
    "cancelled",
  );

  return NextResponse.json({ success: true });
}
