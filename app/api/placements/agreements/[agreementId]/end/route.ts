import { NextResponse } from "next/server";
import { z } from "zod";
import { authoriseAgreement } from "@/lib/placement-access";
import { createServiceClient } from "@/lib/supabase/service";
import {
  setAgreementEndRequest,
  clearAgreementEndRequest,
  updateAgreementStatus,
  getPlacementTitle,
} from "@/lib/db/placements";
import { settlePlacementPaymentsOnEarlyEnd } from "@/lib/db/placement-payments";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import {
  notifyPlacementEndProposed,
  notifyPlacementEnded,
} from "@/lib/notifications";

const schema = z.object({
  action: z.enum(["propose", "confirm", "decline"]),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;

  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { agreement, isKinglancer, isOrgManager, userId } = access;

  if (agreement.status !== "active") {
    return NextResponse.json(
      { error: "Only an active placement can be ended early." },
      { status: 409 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const hasRequest = !!agreement.end_requested_by;
  const proposerIsKinglancer =
    agreement.end_requested_by === agreement.kinglancer_id;
  const db = createServiceClient();

  if (parsed.data.action === "propose") {
    if (hasRequest) {
      return NextResponse.json(
        { error: "There's already a pending request to end this placement." },
        { status: 409 },
      );
    }
    await setAgreementEndRequest(agreementId, userId, parsed.data.reason ?? null);

    // Notify the other party to confirm or decline.
    const [placementTitle, organisationName] = await Promise.all([
      getPlacementTitle(agreement.placement_id),
      getOrganisationName(agreement.organisation_id),
    ]);
    if (isKinglancer) {
      const { data: org } = await db
        .from("organisations")
        .select("email")
        .eq("id", agreement.organisation_id)
        .maybeSingle();
      if (org?.email) {
        void notifyPlacementEndProposed({
          toEmail: org.email,
          placementTitle: placementTitle ?? "your placement",
          proposedBy: "The Kinglancer",
          agreementId,
        }).catch(() => {});
      }
    } else {
      const { data: kinglancer } = await db
        .from("profiles")
        .select("email")
        .eq("id", agreement.kinglancer_id)
        .maybeSingle();
      if (kinglancer?.email) {
        void notifyPlacementEndProposed({
          toEmail: kinglancer.email,
          placementTitle: placementTitle ?? "your placement",
          proposedBy: organisationName ?? "The organisation",
          agreementId,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "decline") {
    if (!hasRequest) {
      return NextResponse.json(
        { error: "There's no pending request to end this placement." },
        { status: 409 },
      );
    }
    await clearAgreementEndRequest(agreementId);
    return NextResponse.json({ ok: true });
  }

  // confirm — only the party who didn't propose can confirm.
  if (!hasRequest) {
    return NextResponse.json(
      { error: "There's no request to confirm." },
      { status: 409 },
    );
  }
  const iAmProposer =
    (isKinglancer && proposerIsKinglancer) ||
    (isOrgManager && !proposerIsKinglancer);
  if (iAmProposer) {
    return NextResponse.json(
      { error: "The other party needs to confirm ending the placement." },
      { status: 403 },
    );
  }

  await updateAgreementStatus(agreementId, "cancelled");
  await clearAgreementEndRequest(agreementId);
  await settlePlacementPaymentsOnEarlyEnd(
    agreementId,
    "Placement ended early by mutual agreement",
  );

  // Let both parties know it's ended.
  const placementTitle =
    (await getPlacementTitle(agreement.placement_id)) ?? "the placement";
  const [{ data: kinglancer }, { data: org }] = await Promise.all([
    db
      .from("profiles")
      .select("email")
      .eq("id", agreement.kinglancer_id)
      .maybeSingle(),
    db
      .from("organisations")
      .select("email")
      .eq("id", agreement.organisation_id)
      .maybeSingle(),
  ]);
  for (const email of [kinglancer?.email, org?.email]) {
    if (email) {
      void notifyPlacementEnded({ toEmail: email, placementTitle }).catch(
        () => {},
      );
    }
  }

  return NextResponse.json({ ok: true });
}
