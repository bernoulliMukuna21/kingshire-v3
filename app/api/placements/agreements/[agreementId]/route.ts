import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getAgreement,
  setAgreementArchivedByKinglancer,
} from "@/lib/db/placements";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";
import { notifyPlacementReadyToFund } from "@/lib/notifications";
import { requireTermsAccepted } from "@/lib/terms";
import { createServiceClient } from "@/lib/supabase/service";

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
  const action =
    body && typeof body === "object"
      ? (body as { action?: unknown }).action
      : null;
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

  if (action === "accept" && !(await requireTermsAccepted(user.id))) {
    return NextResponse.json(
      {
        error: "Please accept our updated terms to continue.",
        needsTerms: true,
      },
      { status: 403 },
    );
  }
  const { data: responded, error } = await createServiceClient().rpc(
    "respond_placement_offer",
    {
      p_agreement_id: agreementId,
      p_worker_id: user.id,
      p_action: action,
    },
  );
  if (error)
    return NextResponse.json(
      { error: "The offer could not be updated. Refresh and retry." },
      { status: 409 },
    );
  if (action === "accept" && responded.payment_mode === "managed") {
    try {
      await ensurePaymentSchedule(responded);
    } catch (error) {
      console.error("[placement/accept] schedule", error);
      return NextResponse.json(
        {
          error:
            "Accepted, but payment setup needs another attempt. Please retry.",
        },
        { status: 503 },
      );
    }
    if (agreement.status === "pending_acceptance") {
      void notifyPlacementReadyToFund({
        organisationId: agreement.organisation_id,
        placementId: agreement.placement_id,
        agreementId,
      }).catch((error) => console.error("[placements] ready-to-fund", error));
    }
  }
  return NextResponse.json({ ok: true, status: responded.status });
}
