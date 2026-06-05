import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ApplicantSelectionConflictError,
  selectApplicant,
} from "@/lib/db/applications";
import { stripe, calculateFees } from "@/lib/stripe";
import { createTransaction } from "@/lib/db/transactions";

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
    // 1. Create Stripe PaymentIntent first — if this fails, nothing in the DB changes
    const { clientChargePence, platformFeeClient, platformFeeKinglancer } =
      calculateFees(job.budget);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: clientChargePence,
      currency: "gbp",
      metadata: {
        job_id: application.job_id,
        client_id: user.id,
        kinglancer_id: application.kinglancer_id,
      },
      description: `KingsHire — ${job.title}`,
    });

    // 2. Update DB: accept application, reject others, set job in_progress
    try {
      await selectApplicant(
        application.job_id,
        applicationId,
        application.kinglancer_id,
      );
    } catch (err) {
      // selectApplicant failed — void the PaymentIntent so the client is never charged
      await stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {});
      throw err;
    }

    // 3. Record transaction in DB
    try {
      await createTransaction({
        job_id: application.job_id,
        client_id: user.id,
        kinglancer_id: application.kinglancer_id,
        amount: job.budget,
        platform_fee_client: platformFeeClient,
        platform_fee_kinglancer: platformFeeKinglancer,
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      });
    } catch (err) {
      // Transaction insert failed after job was already moved to in_progress.
      // Compensate: cancel PI + revert job and application state.
      const db = createServiceClient();
      await Promise.all([
        stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {}),
        db
          .from("jobs")
          .update({ status: "open", kinglancer_id: null })
          .eq("id", application.job_id),
        db
          .from("applications")
          .update({ status: "pending" })
          .eq("job_id", application.job_id)
          .in("status", ["accepted", "rejected"]),
      ]);
      throw err;
    }

    // 4. Notify kinglancer — deferred to payment_intent.succeeded webhook
    //    so the email only fires after the client's card is actually charged.

    return NextResponse.json({
      success: true,
      jobId: application.job_id,
      clientSecret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error("[SELECT APPLICANT] failed:", err);
    if (err instanceof ApplicantSelectionConflictError) {
      return NextResponse.json(
        { error: "A kinglancer has already been selected for this job" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to select applicant" },
      { status: 500 },
    );
  }
}
