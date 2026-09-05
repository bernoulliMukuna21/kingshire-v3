import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrganisationPermission } from "@/lib/organisations";
import { parsePlacementInput, PlacementError } from "@/lib/placements";
import {
  createPlacement,
  listOrganisationPlacements,
} from "@/lib/db/placements";

async function authoriseMember(organisationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: "Unauthorised" }, { status: 401 }),
    };
  }
  const membership = await requireOrganisationPermission(
    organisationId,
    user.id,
    "manage_jobs",
  );
  if (!membership) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { user };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authoriseMember(id);
  if ("error" in auth) return auth.error;
  const placements = await listOrganisationPlacements(id);
  return NextResponse.json({ placements });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await authoriseMember(id);
  if ("error" in auth) return auth.error;

  // Active-subscription gate, consistent with organisation jobs.
  const { data: subscription, error: subscriptionError } =
    await createServiceClient()
      .from("organisation_subscriptions")
      .select("status")
      .eq("organisation_id", id)
      .maybeSingle();
  if (subscriptionError) {
    return NextResponse.json(
      { error: "Unable to verify the Organisation subscription." },
      { status: 503 },
    );
  }
  if (
    subscription &&
    subscription.status !== "active" &&
    subscription.status !== "trialing"
  ) {
    return NextResponse.json(
      {
        error:
          "Reactivate the Organisation subscription before creating placements.",
      },
      { status: 402 },
    );
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

  try {
    const input = parsePlacementInput(body);
    // Every placement is held for manual review before it can go live.
    const placement = await createPlacement({
      organisationId: id,
      createdBy: auth.user.id,
      input,
      requiresManualReview: true,
    });
    return NextResponse.json({ placement }, { status: 201 });
  } catch (err) {
    if (err instanceof PlacementError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[placements] create failed", err);
    return NextResponse.json(
      { error: "Could not create the placement." },
      { status: 500 },
    );
  }
}
