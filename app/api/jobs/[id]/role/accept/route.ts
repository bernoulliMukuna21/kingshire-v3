import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementBySource, updateEngagement } from "@/lib/db/engagements";
import { ensureEngagementSchedule } from "@/lib/settlement/schedules";
import { requireTermsAccepted } from "@/lib/terms";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!(await requireTermsAccepted(user.id))) {
    return NextResponse.json({ error: "Please accept our updated terms to continue.", needsTerms: true }, { status: 403 });
  }

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement || engagement.kinglancer_id !== user.id) {
    return NextResponse.json({ error: "Role engagement not found." }, { status: 404 });
  }
  if (engagement.status !== "pending_acceptance") {
    return NextResponse.json({ error: "This role agreement can no longer be accepted." }, { status: 409 });
  }

  const nextStatus = engagement.settlement_mode === "managed" ? "pending_funding" : "active";
  await updateEngagement(engagement.id, {
    status: nextStatus,
    kinglancer_signed_at: new Date().toISOString(),
    ...(nextStatus === "active" ? { started_at: new Date().toISOString() } : {}),
  });
  await ensureEngagementSchedule(engagement.id);

  await createServiceClient()
    .from("applications")
    .update({ status: "accepted" })
    .eq("job_id", jobId)
    .eq("kinglancer_id", user.id)
    .eq("status", "pending");

  return NextResponse.json({ ok: true, status: nextStatus });
}
