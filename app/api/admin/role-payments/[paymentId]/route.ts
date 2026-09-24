import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { stripe } from "@/lib/stripe";
import {
  getEngagementPayment,
  updateEngagementPaymentStatus,
} from "@/lib/db/engagement-payments";
import { releaseEngagementPayment } from "@/lib/settlement/payouts";

// POST /api/admin/role-payments/[paymentId] — resolve a disputed Organisation
// role period. Operates directly on the shared engagement_payments ledger
// (role periods aren't wrapped by the Placement compat layer).
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

  const payment = await getEngagementPayment(paymentId);
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
    await releaseEngagementPayment(paymentId);
    return NextResponse.json({ ok: true });
  }

  // refund — return the money to the organisation.
  if (payment.stripe_payment_intent_id) {
    await stripe.refunds.create(
      { payment_intent: payment.stripe_payment_intent_id },
      { idempotencyKey: `engagement-refund-${payment.id}` },
    );
  }
  await updateEngagementPaymentStatus(paymentId, "refunded");
  return NextResponse.json({ ok: true });
}
