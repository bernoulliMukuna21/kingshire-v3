import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { adminReviewPlacement } from "@/lib/db/placements";
import { notifyPlacementReviewed } from "@/lib/notifications";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ placementId: string }> },
) {
  const { placementId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action as string | undefined;
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const reason =
    typeof body?.reason === "string" ? body.reason.trim().slice(0, 2000) : "";

  const status = action === "approve" ? "open" : "cancelled";
  const changed = await adminReviewPlacement(placementId, status);
  if (!changed) {
    return NextResponse.json(
      { error: "This placement is no longer awaiting review." },
      { status: 409 },
    );
  }

  // Notify the organisation member who created the placement.
  const svc = createServiceClient();
  const { data: placement } = await svc
    .from("placements")
    .select("title, created_by, organisation_id")
    .eq("id", placementId)
    .maybeSingle();
  if (placement?.created_by) {
    const { data: owner } = await svc
      .from("profiles")
      .select("email")
      .eq("id", placement.created_by)
      .maybeSingle();
    void notifyPlacementReviewed({
      recipientId: placement.created_by,
      recipientEmail: owner?.email ?? undefined,
      placementTitle: placement.title,
      organisationId: placement.organisation_id,
      placementId,
      approved: action === "approve",
      reason: reason || undefined,
    }).catch((err) => console.error("[admin/placements] notify failed:", err));
  }

  return NextResponse.json({ ok: true });
}
