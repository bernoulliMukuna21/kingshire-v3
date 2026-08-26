import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  activateAgreement,
  getAgreement,
  markAgreementPendingFunding,
  setAgreementArchivedByKinglancer,
  updateAgreementStatus,
} from "@/lib/db/placements";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";
import { notifyPlacementReadyToFund } from "@/lib/notifications";

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
  if (action !== "accept" && action !== "decline" && action !== "archive") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const agreement = await getAgreement(agreementId);
  if (!agreement || agreement.kinglancer_id !== user.id) {
    return NextResponse.json(
      { error: "Agreement not found." },
      { status: 404 },
    );
  }

  if (action === "archive") {
    // Hides a finished agreement from the Kinglancer's list only.
    if (agreement.status !== "completed" && agreement.status !== "cancelled") {
      return NextResponse.json(
        { error: "Only finished placements can be hidden." },
        { status: 409 },
      );
    }
    await setAgreementArchivedByKinglancer(agreementId, user.id);
    return NextResponse.json({ ok: true });
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
      // The Kinglancer commits now, but the placement only starts once the org
      // explicitly funds the first month. Build the schedule and hand off.
      await ensurePaymentSchedule(agreement);
      const moved = await markAgreementPendingFunding(agreementId);
      if (!moved) {
        return NextResponse.json(
          { error: "This agreement can no longer be accepted." },
          { status: 409 },
        );
      }
      void notifyPlacementReadyToFund({
        organisationId: agreement.organisation_id,
        placementId: agreement.placement_id,
        agreementId,
      }).catch((err) =>
        console.error("[placements] ready-to-fund notify failed:", err),
      );
      return NextResponse.json({ ok: true, status: "pending_funding" });
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
