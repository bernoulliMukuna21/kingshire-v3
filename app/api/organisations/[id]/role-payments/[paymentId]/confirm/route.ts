import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { requireOrganisationPermission } from "@/lib/organisations";
import { getEngagement } from "@/lib/db/engagements";
import { getEngagementPayment } from "@/lib/db/engagement-payments";
import { reconcileEngagementPayment } from "@/lib/settlement/billing";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id: organisationId, paymentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!(await requireOrganisationPermission(organisationId, user.id, "manage_jobs")))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payment = await getEngagementPayment(paymentId);
  if (!payment || payment.organisation_id !== organisationId)
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || engagement.source_kind !== "org_role" || engagement.organisation_id !== organisationId)
    return NextResponse.json({ error: "Role payment not found." }, { status: 404 });
  if (!payment.stripe_payment_intent_id)
    return NextResponse.json({ error: "This payment has no card verification to complete." }, { status: 409 });

  const body = await request.json().catch(() => ({}));
  if (body?.action === "reconcile") {
    await reconcileEngagementPayment(payment.id, payment.stripe_payment_intent_id);
    return NextResponse.json({ ok: true });
  }

  const intent = await stripe.paymentIntents.retrieve(payment.stripe_payment_intent_id);
  if (intent.metadata.engagement_payment_id !== payment.id)
    return NextResponse.json({ error: "Payment verification mismatch." }, { status: 409 });
  if (intent.status === "succeeded") {
    await reconcileEngagementPayment(payment.id, intent.id);
    return NextResponse.json({ ok: true, completed: true });
  }
  if (intent.status !== "requires_action" || !intent.client_secret)
    return NextResponse.json(
      { error: "This payment is not waiting for card verification." },
      { status: 409 },
    );
  return NextResponse.json({ ok: true, clientSecret: intent.client_secret });
}
