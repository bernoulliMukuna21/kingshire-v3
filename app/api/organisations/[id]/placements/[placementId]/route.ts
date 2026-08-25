import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { notifyAdminPlacementForReview } from "@/lib/notifications";
import { openPlacementLimit } from "@/lib/placements";
import type { OrganisationPlanId } from "@/modules/organisations/domain/plans";
import {
  cancelPendingAgreementsForPlacement,
  countOpenPlacements,
  deletePlacement,
  getOrganisationPlacement,
  placementDeletionBlocker,
  updatePlacementStatus,
} from "@/lib/db/placements";

const ACTIONS = ["publish", "close", "cancel"] as const;
type Action = (typeof ACTIONS)[number];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; placementId: string }> },
) {
  const { id, placementId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) {
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
  const action = (body as { action?: unknown })?.action;
  if (typeof action !== "string" || !ACTIONS.includes(action as Action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const placement = await getOrganisationPlacement(placementId, id);
  if (!placement) {
    return NextResponse.json(
      { error: "Placement not found." },
      { status: 404 },
    );
  }

  if (action === "publish") {
    if (placement.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft placements can be published." },
        { status: 409 },
      );
    }

    const { data: subscription } = await createServiceClient()
      .from("organisation_subscriptions")
      .select("plan, status")
      .eq("organisation_id", id)
      .maybeSingle();

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
      const limit = openPlacementLimit(subscription.plan as OrganisationPlanId);
      const open = await countOpenPlacements(id);
      if (open >= limit) {
        return NextResponse.json(
          {
            error: `Your plan allows ${limit} open placement${limit === 1 ? "" : "s"}. Close one or upgrade to publish another.`,
          },
          { status: 409 },
        );
      }
    }

    // First placements are held for manual review before going live.
    const nextStatus = placement.requires_manual_review
      ? "pending_review"
      : "open";
    const updated = await updatePlacementStatus(placementId, id, nextStatus);
    if (nextStatus === "pending_review") {
      const organisationName =
        (await getOrganisationName(id)) ?? "An Organisation";
      await notifyAdminPlacementForReview({
        placementTitle: placement.title,
        organisationName,
      }).catch((error) =>
        console.error("[placements] admin review email failed", error),
      );
    }
    return NextResponse.json({ placement: updated });
  }

  if (action === "close") {
    if (placement.status !== "open" && placement.status !== "pending_review") {
      return NextResponse.json(
        { error: "Only live placements can be closed." },
        { status: 409 },
      );
    }
    const updated = await updatePlacementStatus(placementId, id, "closed");
    return NextResponse.json({ placement: updated });
  }

  // cancel
  if (placement.status === "cancelled") {
    return NextResponse.json(
      { error: "This placement is already cancelled." },
      { status: 409 },
    );
  }
  const updated = await updatePlacementStatus(placementId, id, "cancelled");
  await cancelPendingAgreementsForPlacement(placementId);
  return NextResponse.json({ placement: updated });
}

// Permanently delete a cancelled/closed placement that has no participants.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; placementId: string }> },
) {
  const { id, placementId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const membership = await getOrganisationMembership(id, user.id);
  if (
    !membership ||
    (membership.role !== "owner" && membership.role !== "admin")
  ) {
    return NextResponse.json(
      { error: "Only owners and admins can delete placements." },
      { status: 403 },
    );
  }

  const placement = await getOrganisationPlacement(placementId, id);
  if (!placement) {
    return NextResponse.json(
      { error: "Placement not found." },
      { status: 404 },
    );
  }
  if (placement.status !== "cancelled" && placement.status !== "closed") {
    return NextResponse.json(
      { error: "Only cancelled or closed placements can be deleted." },
      { status: 409 },
    );
  }
  const blocker = await placementDeletionBlocker(placementId);
  if (blocker) {
    return NextResponse.json(
      { error: `This placement has ${blocker} and can't be deleted.` },
      { status: 409 },
    );
  }

  await deletePlacement(placementId, id);
  return NextResponse.json({ ok: true });
}
