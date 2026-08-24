import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { reviewExperienceRecord } from "@/lib/db/placements";
import { notifyExperienceVerified } from "@/lib/notifications";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId } = await params;

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

  const status = action === "approve" ? "approved" : "rejected";
  const record = await reviewExperienceRecord(recordId, status, user.id);
  if (!record) {
    return NextResponse.json(
      { error: "This record is no longer awaiting review." },
      { status: 409 },
    );
  }

  // Notify the Kinglancer of the outcome.
  const svc = createServiceClient();
  const [{ data: kinglancer }, organisationName] = await Promise.all([
    svc
      .from("profiles")
      .select("email")
      .eq("id", record.kinglancer_id)
      .maybeSingle(),
    getOrganisationName(record.organisation_id),
  ]);
  void notifyExperienceVerified({
    kinglancerId: record.kinglancer_id,
    kinglancerEmail: kinglancer?.email ?? undefined,
    categories: record.categories,
    organisationName: organisationName ?? "An organisation",
    approved: action === "approve",
  }).catch((err) =>
    console.error("[admin/experience-records] notify failed:", err),
  );

  return NextResponse.json({ ok: true });
}
