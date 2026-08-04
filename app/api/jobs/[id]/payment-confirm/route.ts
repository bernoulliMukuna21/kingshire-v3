import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { finalizePaymentAttempt } from "@/lib/db/payment-attempts";
import { captureServerEvent } from "@/lib/posthog-server";

// POST /api/jobs/[id]/payment-confirm
// Called by the pay page after stripe.confirmPayment() succeeds.
// Verifies the PaymentIntent status with Stripe and finalizes escrow.
export async function POST(
  request: Request,
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

  const body = await request.json();
  const { paymentIntentId } = body as { paymentIntentId: string };

  if (!paymentIntentId) {
    return NextResponse.json(
      { error: "Missing paymentIntentId" },
      { status: 400 },
    );
  }

  // Verify the PaymentIntent actually succeeded via Stripe (don't trust the client)
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (paymentIntent.status !== "succeeded") {
    return NextResponse.json(
      { error: "Payment has not been completed" },
      { status: 402 },
    );
  }

  // Verify this PI belongs to this job and this client
  if (
    paymentIntent.metadata.job_id !== jobId ||
    paymentIntent.metadata.client_id !== user.id
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await finalizePaymentAttempt(paymentIntentId);

  await captureServerEvent({
    distinctId: user.id,
    event: "payment_confirmed",
    properties: {
      job_id: jobId,
      payment_type: paymentIntent.metadata.attempt_type ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
