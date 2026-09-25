import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/lib/organisations";
import {
  activeParticipantLimit,
  summarizePlacementCompensation,
  managedMonthlyAmount,
} from "@/lib/placements";
import { requireTermsAccepted } from "@/lib/terms";
import type { OrganisationPlanId } from "@/modules/organisations/domain/plans";
import {
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
  const action =
    body && typeof body === "object"
      ? (body as { action?: unknown }).action
      : null;
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
  if (
    application.status !== "pending" &&
    !(action === "accept" && application.status === "offered")
  ) {
    return NextResponse.json(
      { error: "This application has already been handled." },
      { status: 409 },
    );
  }

  if (action === "reject") {
    const rejected = await updatePlacementApplicationStatus(
      applicationId,
      "rejected",
    );
    if (!rejected)
      return NextResponse.json(
        { error: "This application has already been handled." },
        { status: 409 },
      );
    return NextResponse.json({ ok: true });
  }

  if (!(await requireTermsAccepted(user.id))) {
    return NextResponse.json(
      {
        error: "Please accept our updated terms to continue.",
        needsTerms: true,
      },
      { status: 403 },
    );
  }

  // Accept — run the seat/subscription checks and the notify-email lookup
  // together rather than one sequential round trip after another.
  const service = createServiceClient();
  const [{ data: subscription }, { data: kinglancer }] = await Promise.all([
    service
      .from("organisation_subscriptions")
      .select("plan, status")
      .eq("organisation_id", id)
      .maybeSingle(),
    service
      .from("profiles")
      .select("email")
      .eq("id", application.kinglancer_id)
      .maybeSingle(),
  ]);

  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return NextResponse.json(
      { error: "Reactivate the Organisation subscription first." },
      { status: 402 },
    );
  }
  const { data: agreement, error: offerError } = await service.rpc(
    "offer_placement_application",
    {
      p_application_id: applicationId,
      p_signer_id: user.id,
      p_expected_plan: subscription.plan,
      p_seat_limit: activeParticipantLimit(
        subscription.plan as OrganisationPlanId,
      ),
      p_reward_terms:
        summarizePlacementCompensation(placement) ||
        placement.reward ||
        "Supervised experience, mentoring and a verified record.",
      p_monthly_amount: managedMonthlyAmount(placement) ?? 0,
    },
  );
  if (offerError)
    return NextResponse.json(
      {
        error:
          "The offer could not be created. Check available participant seats and refresh before retrying.",
      },
      { status: 409 },
    );

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
