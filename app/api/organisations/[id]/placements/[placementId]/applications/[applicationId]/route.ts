import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/lib/organisations";
import { activeParticipantLimit } from "@/lib/placements";
import type { OrganisationPlanId } from "@/modules/organisations/domain/plans";
import {
  countReservedParticipants,
  createAgreementFromPlacement,
  getOrganisationPlacement,
  getPlacementApplication,
  updatePlacementApplicationStatus,
} from "@/lib/db/placements";
import { notifyPlacementOffer } from "@/lib/notifications";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; placementId: string; applicationId: string }>;
  },
) {
  const { id, placementId, applicationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (
    !(await requireOrganisationPermission(id, user.id, "manage_applicants"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const [placement, application] = await Promise.all([
    getOrganisationPlacement(placementId, id),
    getPlacementApplication(applicationId),
  ]);
  if (!placement) {
    return NextResponse.json(
      { error: "Placement not found." },
      { status: 404 },
    );
  }
  if (!application || application.placement_id !== placementId) {
    return NextResponse.json(
      { error: "Application not found." },
      { status: 404 },
    );
  }
  if (application.status !== "pending") {
    return NextResponse.json(
      { error: "This application has already been handled." },
      { status: 409 },
    );
  }

  if (action === "reject") {
    await updatePlacementApplicationStatus(applicationId, "rejected");
    return NextResponse.json({ ok: true });
  }

  // Accept — run the seat/subscription checks and the notify-email lookup
  // together rather than one sequential round trip after another.
  const service = createServiceClient();
  const [{ data: subscription }, reserved, { data: kinglancer }] =
    await Promise.all([
      service
        .from("organisation_subscriptions")
        .select("plan, status")
        .eq("organisation_id", id)
        .maybeSingle(),
      countReservedParticipants(id),
      service
        .from("profiles")
        .select("email")
        .eq("id", application.kinglancer_id)
        .maybeSingle(),
    ]);

  if (
    subscription &&
    subscription.status !== "active" &&
    subscription.status !== "trialing"
  ) {
    return NextResponse.json(
      { error: "Reactivate the Organisation subscription first." },
      { status: 402 },
    );
  }
  if (subscription) {
    const limit = activeParticipantLimit(
      subscription.plan as OrganisationPlanId,
    );
    if (reserved >= limit) {
      return NextResponse.json(
        {
          error: `Your plan allows ${limit} active participant${limit === 1 ? "" : "s"}. Complete or cancel a placement to free a seat.`,
        },
        { status: 409 },
      );
    }
  }

  // A managed placement collects payment later, when the org explicitly funds
  // the first month (an on-session Stripe Checkout that can add a card), so we
  // don't block accepting an applicant on a saved card here.

  const [agreement] = await Promise.all([
    createAgreementFromPlacement({
      placement,
      kinglancerId: application.kinglancer_id,
      orgSignedBy: user.id,
    }),
    updatePlacementApplicationStatus(applicationId, "accepted"),
  ]);

  // Fire-and-forget: a slow email must not hang the accept response.
  void notifyPlacementOffer({
    kinglancerId: application.kinglancer_id,
    kinglancerEmail: kinglancer?.email ?? undefined,
    placementTitle: placement.title,
    agreementId: agreement.id,
  }).catch((err) =>
    console.error("[placements/applications] notify failed:", err),
  );

  return NextResponse.json(
    { ok: true, agreementId: agreement.id },
    { status: 201 },
  );
}
