import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getEngagementBySource } from "@/lib/db/engagements";
import { requireOrganisationPermission } from "@/lib/organisations";
import { withdrawPendingRoleEngagement } from "@/lib/settlement/role-engagements";

const schema = z.object({
  reason: z.string().trim().max(2000).optional(),
});

// POST /api/jobs/[id]/role/withdraw — either party can withdraw a role offer
// before any money has moved (pending_acceptance or pending_funding). Ending
// an already-active, paid role uses /role/end's propose/confirm flow instead.
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
  const isOrgManager = isKinglancer
    ? false
    : !!(await requireOrganisationPermission(
        engagement.organisation_id,
        user.id,
        "manage_jobs",
      ));
  if (!isKinglancer && !isOrgManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["pending_acceptance", "pending_funding"].includes(engagement.status)) {
    return NextResponse.json(
      {
        error:
          "Only an offer that hasn't been funded yet can be withdrawn this way.",
      },
      { status: 409 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const updated = await withdrawPendingRoleEngagement(
      engagement.id,
      user.id,
      parsed.data.reason,
    );
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (err) {
    const message = (err as { message?: string } | null)?.message;
    return NextResponse.json(
      {
        error:
          message && message.length < 200
            ? message
            : "Could not withdraw this offer. Refresh and retry.",
      },
      { status: 409 },
    );
  }
}
