import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/lib/organisations";
import { openPlacementLimit } from "@/lib/placements";
import type { OrganisationPlanId } from "@/modules/organisations/domain/plans";
import {
  countOpenPlacements,
  getOrganisationPlacement,
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
    return NextResponse.json({ error: "Placement not found." }, { status: 404 });
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
  return NextResponse.json({ placement: updated });
}
