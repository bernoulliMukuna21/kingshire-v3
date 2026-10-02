import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementBySource, createEngagementCheckIn } from "@/lib/db/engagements";
import { requireOrganisationPermission, getOrgOwnerContact } from "@/lib/organisations";
import { notifyRoleCheckIn } from "@/lib/notifications";

// POST /api/jobs/[id]/role/check-ins — post an update or question on an
// active role. Either the Kinglancer or an organisation manager may post;
// the other party is notified. Mirrors the placement check-in feed.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement) {
    return NextResponse.json(
      { error: "Role engagement not found." },
      { status: 404 },
    );
  }

  const isKinglancer = engagement.kinglancer_id === user.id;
  const isOrgManager =
    !isKinglancer &&
    !!(await requireOrganisationPermission(
      engagement.organisation_id,
      user.id,
      "manage_jobs",
    ));
  if (!isKinglancer && !isOrgManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (engagement.status !== "active") {
    return NextResponse.json(
      { error: "Check-ins are only available on an active role." },
      { status: 409 },
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
  const raw = (body as { note?: unknown }).note;
  const note = typeof raw === "string" ? raw.trim() : "";
  if (note.length < 1 || note.length > 2000) {
    return NextResponse.json(
      { error: "Check-in must be between 1 and 2000 characters." },
      { status: 400 },
    );
  }

  await createEngagementCheckIn({
    engagementId: engagement.id,
    authorId: user.id,
    note,
  });

  // Notify the other party (fire-and-forget).
  const db = createServiceClient();
  const [{ data: job }, { data: author }] = await Promise.all([
    db.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    db.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const orgOwner = isKinglancer
    ? await getOrgOwnerContact(engagement.organisation_id)
    : null;
  const recipientId = isKinglancer ? orgOwner?.userId : engagement.kinglancer_id;
  if (job && recipientId) {
    const recipientEmail = isKinglancer
      ? (orgOwner?.email ?? undefined)
      : await db
          .from("profiles")
          .select("email")
          .eq("id", recipientId)
          .maybeSingle()
          .then(({ data }) => data?.email ?? undefined);
    void notifyRoleCheckIn({
      recipientId,
      recipientEmail,
      jobTitle: job.title,
      authorName: author?.full_name ?? "Someone",
      link: isKinglancer
        ? `/dashboard/organisations/${engagement.organisation_id}/jobs/${jobId}/offer`
        : `/dashboard/kinglancer/jobs/${jobId}`,
    }).catch((err) =>
      console.error("[role check-ins] notify failed:", err),
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
