import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import {
  getPlacementPayment,
  updatePlacementPaymentStatus,
} from "@/lib/db/placement-payments";
import { firePlacementPayout } from "@/lib/placement-payouts";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const { paymentId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  if (action !== "release" && action !== "refund") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const payment = await getPlacementPayment(paymentId);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.status !== "disputed") {
    return NextResponse.json(
      { error: "This payment is not under dispute." },
      { status: 409 },
    );
  }

  if (action === "release") {
    // Transfer the held escrow to the Kinglancer.
    await firePlacementPayout(payment);
    return NextResponse.json({ ok: true });
  }

  // refund — return the money to the organisation.
  if (payment.stripe_payment_intent_id) {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { idempotencyKey: `placement-refund-${payment.id}` },
    );
  }
  await updatePlacementPaymentStatus(paymentId, { status: "refunded" });
  return NextResponse.json({ ok: true });
}
