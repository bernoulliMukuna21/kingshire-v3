import { NextResponse } from "next/server";
import { startEngagementCheckout } from "@/lib/settlement/checkout";
import { authoriseAgreement } from "@/lib/placement-access";
import { getPlacementPayment } from "@/lib/db/placement-payments";

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

  try {
    const url = await startEngagementCheckout(payment.id);
    if (!url)
      return NextResponse.json(
        {
          error:
            "Payment is already being processed or the checkout expired. Refresh before retrying.",
        },
        { status: 409 },
      );
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[placement-checkout]", error);
    return NextResponse.json(
      {
        error:
          "Could not open checkout. Your existing payment attempt is preserved; please retry.",
      },
      { status: 502 },
    );
  }
}
