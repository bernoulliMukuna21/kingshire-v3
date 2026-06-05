import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { stripe, calculateFees } from "@/lib/stripe";
import { createTransaction } from "@/lib/db/transactions";

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

    const paymentIntent = await stripe.paymentIntents.create({
      amount: clientChargePence,
      currency: "gbp",
      metadata: {
        job_id: job.id,
        client_id: user.id,
        kinglancer_id: job.invited_kinglancer_id,
      },
      description: `KingsHire — ${job.title}`,
    });

    const db = createServiceClient();

    try {
      const { error: jobError } = await db
        .from("jobs")
        .update({
          status: "in_progress",
          kinglancer_id: job.invited_kinglancer_id,
        })
        .eq("id", job.id)
        .eq("client_id", user.id)
        .eq("direct_request_status", "accepted_pending_payment");

      if (jobError) throw jobError;

      await createTransaction({
        job_id: job.id,
        client_id: user.id,
        kinglancer_id: job.invited_kinglancer_id,
        amount: job.budget,
        platform_fee_client: platformFeeClient,
        platform_fee_kinglancer: platformFeeKinglancer,
        stripe_payment_intent_id: paymentIntent.id,
        status: "pending",
      });
    } catch (err) {
      await Promise.all([
        stripe.paymentIntents.cancel(paymentIntent.id).catch(() => {}),
        db
          .from("jobs")
          .update({ status: "open", kinglancer_id: null })
          .eq("id", job.id),
      ]);
      throw err;
    }

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
