import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  createPlacementApplication,
  getOpenPlacement,
  hasAppliedToPlacement,
} from "@/lib/db/placements";
import { notifyPlacementApplicationReceived } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await createServiceClient()
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "kinglancer") {
    return NextResponse.json(
      { error: "Switch to your Kinglancer account to apply for placements." },
      { status: 403 },
    );
  }

  const placement = await getOpenPlacement(id);
  if (!placement) {
    return NextResponse.json(
      { error: "This placement is no longer open." },
      { status: 404 },
    );
  }

  if (await hasAppliedToPlacement(id, user.id)) {
    return NextResponse.json(
      { error: "You have already applied to this placement." },
      { status: 409 },
    );
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const raw = (body as { message?: unknown }).message;
  const message = typeof raw === "string" ? raw.trim().slice(0, 2000) : "";

  await createPlacementApplication({
    placementId: id,
    kinglancerId: user.id,
    message: message || null,
  });

  if (placement.created_by) {
    const { data: owner } = await createServiceClient()
      .from("profiles")
      .select("email")
      .eq("id", placement.created_by)
      .maybeSingle();
    await notifyPlacementApplicationReceived({
      recipientId: placement.created_by,
      recipientEmail: owner?.email ?? undefined,
      placementTitle: placement.title,
      placementId: placement.id,
      organisationId: placement.organisation_id,
    }).catch((err) =>
      console.error("[placements/apply] notify failed:", err),
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
