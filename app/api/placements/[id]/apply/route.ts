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
    .select("role, open_to_placements")
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

  const rawCv = (body as { cvUrl?: unknown }).cvUrl;
  let cvUrl: string | null = null;
  if (typeof rawCv === "string" && rawCv.trim()) {
    const expectedPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/placement-cvs/`;
    if (!expectedPrefix || !rawCv.startsWith(expectedPrefix)) {
      return NextResponse.json(
        { error: "Invalid CV upload. Please re-attach your CV." },
        { status: 400 },
      );
    }
    cvUrl = rawCv;
  }

  // Placements are opt-in. A Kinglancer who has not enabled "Open to
  // placements" must explicitly consent (optIn) at the point of applying;
  // that consent is recorded as the single source of truth on their profile.
  if (!profile.open_to_placements) {
    const optIn = (body as { optIn?: unknown }).optIn === true;
    if (!optIn) {
      return NextResponse.json({ error: "opt_in_required" }, { status: 403 });
    }
    const { error: optInError } = await createServiceClient()
      .from("profiles")
      .update({ open_to_placements: true })
      .eq("id", user.id);
    if (optInError) {
      return NextResponse.json(
        { error: "Could not record your placement opt-in. Please try again." },
        { status: 500 },
      );
    }
  }

  await createPlacementApplication({
    placementId: id,
    kinglancerId: user.id,
    message: message || null,
    cvUrl,
  });

  if (placement.created_by) {
    const { data: owner } = await createServiceClient()
      .from("profiles")
      .select("email")
      .eq("id", placement.created_by)
      .maybeSingle();
    void notifyPlacementApplicationReceived({
      recipientId: placement.created_by,
      recipientEmail: owner?.email ?? undefined,
      placementTitle: placement.title,
      placementId: placement.id,
      organisationId: placement.organisation_id,
    }).catch((err) => console.error("[placements/apply] notify failed:", err));
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
