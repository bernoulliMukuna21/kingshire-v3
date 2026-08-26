import { NextResponse } from "next/server";
import { z } from "zod";
import { authoriseAgreement } from "@/lib/placement-access";
import { getOrganisationMembership } from "@/lib/organisations";
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

  // On the org side, only owners/admins may end a placement early.
  if (isOrgManager) {
    const membership = await getOrganisationMembership(
      agreement.organisation_id,
      userId,
    );
    if (
      !membership ||
      (membership.role !== "owner" && membership.role !== "admin")
    ) {
      return NextResponse.json(
        { error: "Only owners and admins can end a placement early." },
        { status: 403 },
      );
    }
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
  if (
    parsed.data.action === "propose" &&
    (parsed.data.reason ?? "").trim().split(/\s+/).filter(Boolean).length < 20
  ) {
    return NextResponse.json(
      { error: "Please give a reason for ending early (at least 20 words)." },
      { status: 400 },
    );
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
    await setAgreementEndRequest(
      agreementId,
      userId,
      parsed.data.reason ?? null,
    );

    // Notify the other party (in-app + email) to confirm or decline.
    const [placementTitle, organisationName] = await Promise.all([
      getPlacementTitle(agreement.placement_id),
      getOrganisationName(agreement.organisation_id),
    ]);
    if (isKinglancer) {
      const owner = await getOrgOwner(agreement.organisation_id);
      if (owner) {
        void notifyPlacementEndProposed({
          recipientId: owner.userId,
          recipientEmail: owner.email ?? undefined,
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
      void notifyPlacementEndProposed({
        recipientId: agreement.kinglancer_id,
        recipientEmail: kinglancer?.email ?? undefined,
        placementTitle: placementTitle ?? "your placement",
        proposedBy: organisationName ?? "The organisation",
        agreementId,
      }).catch(() => {});
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

  // Let both parties know it's ended (in-app + email).
  const placementTitle =
    (await getPlacementTitle(agreement.placement_id)) ?? "the placement";
  const [{ data: kinglancer }, owner] = await Promise.all([
    db
      .from("profiles")
      .select("email")
      .eq("id", agreement.kinglancer_id)
      .maybeSingle(),
    getOrgOwner(agreement.organisation_id),
  ]);
  void notifyPlacementEnded({
    recipientId: agreement.kinglancer_id,
    recipientEmail: kinglancer?.email ?? undefined,
    placementTitle,
    agreementId,
  }).catch(() => {});
  if (owner) {
    void notifyPlacementEnded({
      recipientId: owner.userId,
      recipientEmail: owner.email ?? undefined,
      placementTitle,
      agreementId,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

/** The org owner's user id + email, for notifications. */
async function getOrgOwner(
  organisationId: string,
): Promise<{ userId: string; email: string | null } | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("organisation_members")
    .select("user_id, profiles:profiles!user_id(email)")
    .eq("organisation_id", organisationId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data?.user_id) return null;
  const p = (
    data as unknown as {
      profiles: { email: string | null }[] | { email: string | null } | null;
    }
  ).profiles;
  const email = Array.isArray(p) ? (p[0]?.email ?? null) : (p?.email ?? null);
  return { userId: data.user_id as string, email };
}
