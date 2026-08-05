import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { adminReviewPlacement } from "@/lib/db/placements";

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

  const status = action === "approve" ? "open" : "cancelled";
  const changed = await adminReviewPlacement(placementId, status);
  if (!changed) {
    return NextResponse.json(
      { error: "This placement is no longer awaiting review." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
