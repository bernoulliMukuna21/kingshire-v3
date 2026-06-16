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

type ApplicationRow = {
  id: string;
  job_id: string;
  kinglancer_id: string;
  status: string;
  cover_letter: string;
  proposed_rate: number | null;
  created_at: string;
  job: { client_id: string; status: string; budget: number; title: string };
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body; // 'accept' only for now

  if (action !== "accept") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  // Fetch the application and verify ownership
  const { data: applicationRaw } = await supabase
    .from("applications")
    .select("*, job:jobs!job_id(client_id, status, budget, title)")
    .eq("id", applicationId)
    .single();

  if (!applicationRaw) {
    return NextResponse.json(
      { error: "Application not found" },
      { status: 404 },
    );
  }

  const application = applicationRaw as unknown as ApplicationRow;
  const job = application.job;

  if (job.client_id !== user.id) {
    return NextResponse.json(
      { error: "You do not have permission to do this" },
      { status: 403 },
    );
  }

  if (job.status !== "open") {
    return NextResponse.json(
      { error: "A kinglancer has already been selected for this job" },
      { status: 409 },
    );
  }

  if (application.status !== "pending") {
    return NextResponse.json(
      { error: "This application is no longer pending" },
      { status: 409 },
    );
  }

  try {
    const { clientChargePence, platformFeeClient, platformFeeKinglancer } =
      calculateFees(job.budget);

    const existingAttempt = await getPendingPaymentAttemptByJob(
      application.job_id,
    );

    if (existingAttempt) {
      if (
        existingAttempt.application_id !== applicationId ||
        existingAttempt.kinglancer_id !== application.kinglancer_id
      ) {
        return NextResponse.json(
          {
            error:
              "A payment is already pending for this job. Cancel it before selecting someone else.",
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
            jobId: application.job_id,
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
      metadata: {
        job_id: application.job_id,
        client_id: user.id,
        kinglancer_id: application.kinglancer_id,
        application_id: applicationId,
        attempt_type: "application",
      },
      description: `KingsHire — ${job.title}`,
    });

    try {
      await createPaymentAttempt({
        job_id: application.job_id,
        application_id: applicationId,
        client_id: user.id,
        kinglancer_id: application.kinglancer_id,
        amount: job.budget,
        platform_fee_client: platformFeeClient,
        platform_fee_kinglancer: platformFeeKinglancer,
        stripe_payment_intent_id: paymentIntent.id,
        attempt_type: "application",
        status: "pending",
      });
    } catch (err) {
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      throw err;
    }

    return NextResponse.json({
      success: true,
      jobId: application.job_id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("[START APPLICANT PAYMENT] failed:", err);
    return NextResponse.json(
      { error: "Failed to select applicant" },
      { status: 500 },
    );
  }
}
