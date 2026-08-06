import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, calculateFees } from "@/lib/stripe";
import {
  createPaymentAttempt,
  finalizePaymentAttempt,
  getPendingPaymentAttemptByJob,
  isCancellablePaymentIntentStatus,
  updatePaymentAttemptStatus,
} from "@/lib/db/payment-attempts";
import { captureServerEvent } from "@/lib/posthog-server";

type DirectPayJob = {
  id: string;
  client_id: string;
  title: string;
  budget: number;
  status: string;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: jobRaw } = await supabase
    .from("jobs")
    .select(
      "id, client_id, title, budget, status, invited_kinglancer_id, direct_request_status",
    )
    .eq("id", jobId)
    .single();

  if (!jobRaw) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = jobRaw as DirectPayJob;
  if (job.client_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!job.invited_kinglancer_id) {
    return NextResponse.json(
      { error: "This is not a direct request." },
      { status: 400 },
    );
  }
  if (
    job.status !== "open" ||
    job.direct_request_status !== "accepted_pending_payment"
  ) {
    return NextResponse.json(
      { error: "This request is not ready for payment." },
      { status: 409 },
    );
  }

  try {
    const { clientChargePence, platformFeeClient, platformFeeKinglancer } =
      calculateFees(job.budget);

    const existingAttempt = await getPendingPaymentAttemptByJob(job.id);

    if (existingAttempt) {
      if (
        existingAttempt.attempt_type !== "direct_request" ||
        existingAttempt.kinglancer_id !== job.invited_kinglancer_id
      ) {
        return NextResponse.json(
          {
            error:
              "A payment is already pending for this job. Cancel it before starting another payment.",
          },
          { status: 409 },
        );
      }

      try {
        const existingPaymentIntent = await stripe.paymentIntents.retrieve(
          existingAttempt.stripe_payment_intent_id,
        );

        if (
          isCancellablePaymentIntentStatus(existingPaymentIntent.status) &&
          existingPaymentIntent.client_secret
        ) {
          return NextResponse.json({
            success: true,
            jobId: job.id,
            clientSecret: existingPaymentIntent.client_secret,
          });
        }

        if (existingPaymentIntent.status === "succeeded") {
          await finalizePaymentAttempt(existingPaymentIntent.id);
          return NextResponse.json(
            { error: "Payment has already completed for this job." },
            { status: 409 },
          );
        }

        if (existingPaymentIntent.status === "processing") {
          return NextResponse.json(
            { error: "Payment is still processing. Please wait." },
            { status: 409 },
          );
        }

        if (existingPaymentIntent.status === "canceled") {
          await updatePaymentAttemptStatus(
            existingPaymentIntent.id,
            "cancelled",
          );
        } else {
          await updatePaymentAttemptStatus(existingPaymentIntent.id, "failed");
        }
      } catch (err: unknown) {
        const stripeError = err as { code?: string };
        if (stripeError.code === "resource_missing") {
          await updatePaymentAttemptStatus(
            existingAttempt.stripe_payment_intent_id,
            "failed",
          );
        } else {
          throw err;
        }
      }
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: clientChargePence,
      currency: "gbp",
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        job_id: job.id,
        client_id: user.id,
        kinglancer_id: job.invited_kinglancer_id,
        attempt_type: "direct_request",
      },
      description: `KingsHire — ${job.title}`,
    });

    try {
      await createPaymentAttempt({
        job_id: job.id,
        application_id: null,
        client_id: user.id,
        kinglancer_id: job.invited_kinglancer_id,
        amount: job.budget,
        platform_fee_client: platformFeeClient,
        platform_fee_kinglancer: platformFeeKinglancer,
        stripe_payment_intent_id: paymentIntent.id,
        attempt_type: "direct_request",
      });
    } catch (err) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      throw err;
    }

    await captureServerEvent({
      distinctId: user.id,
      event: "payment_started",
      properties: {
        job_id: job.id,
        amount: job.budget,
        payment_type: "direct_request",
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("[DIRECT PAY] failed:", err);
    return NextResponse.json(
      { error: "Failed to start payment." },
      { status: 500 },
    );
  }
}
