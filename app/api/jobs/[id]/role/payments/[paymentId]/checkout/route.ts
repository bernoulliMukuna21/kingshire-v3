import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEngagementBySource } from "@/lib/db/engagements";
import { getEngagementPayment } from "@/lib/db/engagement-payments";
import { requireOrganisationPermission } from "@/lib/organisations";
import { startEngagementCheckout } from "@/lib/settlement/checkout";

// POST /api/jobs/[id]/role/payments/[paymentId]/checkout — start (or resume)
// an explicit, on-session Stripe Checkout for a role's payment period. First
// funding is never charged automatically off-session (see billing.ts), so
// this is the only way period 1 activates the role.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const { id: jobId, paymentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement) {
    return NextResponse.json(
      { error: "Role engagement not found." },
      { status: 404 },
    );
  }

  const canManage = await requireOrganisationPermission(
    engagement.organisation_id,
    user.id,
    "manage_jobs",
  );
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["pending_funding", "active"].includes(engagement.status)) {
    return NextResponse.json(
      { error: "This role isn't awaiting funding." },
      { status: 409 },
    );
  }

  const payment = await getEngagementPayment(paymentId);
  if (!payment || payment.engagement_id !== engagement.id) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  // Before the role starts, only the first period is fundable — that's what
  // activates it.
  if (
    engagement.status === "pending_funding" &&
    payment.period_index !== 1
  ) {
    return NextResponse.json(
      { error: "Fund the first period to activate this role." },
      { status: 409 },
    );
  }
  if (
    payment.status !== "due" &&
    payment.status !== "failed" &&
    payment.status !== "processing"
  ) {
    return NextResponse.json(
      { error: "This payment has already been settled." },
      { status: 409 },
    );
  }

  try {
    const url = await startEngagementCheckout(payment.id);
    if (!url) {
      return NextResponse.json(
        { error: "Could not start checkout. Refresh and retry." },
        { status: 409 },
      );
    }
    return NextResponse.json({ url });
  } catch (err) {
    const message = (err as { message?: string } | null)?.message;
    return NextResponse.json(
      {
        error:
          message && message.length < 200
            ? message
            : "Could not start checkout. Refresh and retry.",
      },
      { status: 409 },
    );
  }
}
