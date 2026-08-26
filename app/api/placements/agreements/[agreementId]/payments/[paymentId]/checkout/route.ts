import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { authoriseAgreement } from "@/lib/placement-access";
import {
  getPlacementPayment,
  updatePlacementPaymentStatus,
} from "@/lib/db/placement-payments";

// POST — start a Stripe Checkout session for one month of a managed placement.
export async function POST(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ agreementId: string; paymentId: string }>;
  },
) {
  const { agreementId, paymentId } = await params;

  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }
  if (!access.isOrgManager) {
    return NextResponse.json(
      { error: "Only the organisation can fund this placement." },
      { status: 403 },
    );
  }
  if (
    access.agreement.status !== "active" &&
    access.agreement.status !== "pending_funding"
  ) {
    return NextResponse.json(
      { error: "The placement isn't active yet." },
      { status: 409 },
    );
  }

  const payment = await getPlacementPayment(paymentId);
  if (!payment || payment.agreement_id !== agreementId) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  // Before the placement starts, only the first month is fundable — that's what
  // activates it.
  if (
    access.agreement.status === "pending_funding" &&
    payment.period_index !== 1
  ) {
    return NextResponse.json(
      { error: "Fund the first month to start the placement." },
      { status: 409 },
    );
  }
  if (
    payment.status !== "due" &&
    payment.status !== "failed" &&
    payment.status !== "processing"
  ) {
    return NextResponse.json(
      { error: "This month has already been funded." },
      { status: 409 },
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const chargePence = Math.round(
    (Number(payment.amount) + Number(payment.platform_fee_client)) * 100,
  );

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: chargePence,
          product_data: {
            name: `Placement payment — month ${payment.period_index}`,
          },
        },
      },
    ],
    payment_intent_data: {
      metadata: {
        purpose: "placement_payment",
        placement_payment_id: payment.id,
      },
    },
    metadata: {
      purpose: "placement_payment",
      placement_payment_id: payment.id,
    },
    success_url: `${appUrl}/dashboard/placements/agreements/${agreementId}?paid=1`,
    cancel_url: `${appUrl}/dashboard/placements/agreements/${agreementId}?cancelled=1`,
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Could not start checkout." },
      { status: 502 },
    );
  }

  await updatePlacementPaymentStatus(payment.id, {
    status: "processing",
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : payment.stripe_payment_intent_id,
  });

  return NextResponse.json({ url: session.url });
}
