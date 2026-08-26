import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  activateAgreement,
  getAgreement,
  updateAgreementStatus,
} from "@/lib/db/placements";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";
import {
  getOrgPaymentContext,
  chargeDuePlacementPayment,
} from "@/lib/placement-billing";
import { notifyPlacementPaymentNeeded } from "@/lib/notifications";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }
  const action = (body as { action?: unknown }).action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const agreement = await getAgreement(agreementId);
  if (!agreement || agreement.kinglancer_id !== user.id) {
    return NextResponse.json(
      { error: "Agreement not found." },
      { status: 404 },
    );
  }
  if (agreement.status !== "pending_acceptance") {
    return NextResponse.json(
      { error: "This agreement can no longer be changed." },
      { status: 409 },
    );
  }

  if (action === "accept") {
    const isManaged =
      agreement.payment_mode === "managed" && !!agreement.monthly_amount;

    if (isManaged) {
      // The org's payment readiness is a precondition of *offering* a paid
      // placement (enforced when the org accepts an applicant). If the card
      // has since lapsed, don't surface an org-facing error to the Kinglancer
      // — nudge the org and keep the offer open.
      const ctx = await getOrgPaymentContext(agreement.organisation_id);
      let started = false;
      if (ctx) {
        const schedule = await ensurePaymentSchedule(agreement);
        const firstMonth = schedule.find((p) => p.period_index === 1);
        started =
          !firstMonth ||
          firstMonth.status === "held" ||
          firstMonth.status === "released" ||
          (await chargeDuePlacementPayment(firstMonth)) === "charged";
      }
      if (!started) {
        void notifyPlacementPaymentNeeded({
          organisationId: agreement.organisation_id,
          placementId: agreement.placement_id,
        }).catch((err) =>
          console.error("[placements] payment-needed notify failed:", err),
        );
        return NextResponse.json(
          {
            error:
              "This placement can't start just yet — the organisation still needs to set up payment. We've let them know, so you can accept once it's sorted.",
          },
          { status: 409 },
        );
      }
      // A successful charge is held in escrow and auto-activates the agreement.
      return NextResponse.json({ ok: true });
    }

    const activated = await activateAgreement(agreementId);
    if (!activated) {
      return NextResponse.json(
        { error: "This agreement can no longer be accepted." },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  }

  await updateAgreementStatus(agreementId, "cancelled");
  return NextResponse.json({ ok: true });
}
