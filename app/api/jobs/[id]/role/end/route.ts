import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementBySource, updateEngagement } from "@/lib/db/engagements";
import { settleEngagementPaymentsOnEarlyEnd } from "@/lib/settlement/termination";
import { requireOrganisationPermission, getOrgOwnerContact } from "@/lib/organisations";
import {
  notifyRoleEndProposed,
  notifyRoleEndDeclined,
  notifyRoleEnded,
  notifyAdminRoleEndDispute,
} from "@/lib/notifications";

const schema = z.object({
  action: z.enum(["propose", "confirm", "decline", "escalate"]),
  reason: z.string().trim().max(2000).optional(),
});

// POST /api/jobs/[id]/role/end — propose/confirm/decline/escalate ending an
// active Organisation-role engagement early. Mirrors the Placement early-end
// flow: either party proposes, the other confirms or declines, and either
// side can escalate to KingsHire while the role stays active.
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

  if (engagement.status !== "active") {
    return NextResponse.json(
      { error: "Only an active role can be ended early." },
      { status: 409 },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const db = createServiceClient();
  const [{ data: job }, { data: kinglancer }] = await Promise.all([
    db.from("jobs").select("title").eq("id", jobId).maybeSingle(),
    db
      .from("profiles")
      .select("email")
      .eq("id", engagement.kinglancer_id)
      .maybeSingle(),
  ]);
  const jobTitle = job?.title ?? "your role";
  const orgOwner = await getOrgOwnerContact(engagement.organisation_id);
  const orgLink = `/dashboard/organisations/${engagement.organisation_id}/jobs/${jobId}`;
  const kinglancerLink = `/dashboard/kinglancer/jobs/${jobId}`;

  const hasRequest = !!engagement.end_requested_by;
  const proposerIsKinglancer =
    engagement.end_requested_by === engagement.kinglancer_id;

  if (parsed.data.action === "propose") {
    if (hasRequest) {
      return NextResponse.json(
        { error: "There's already a pending request to end this role." },
        { status: 409 },
      );
    }
    await updateEngagement(engagement.id, {
      end_requested_by: user.id,
      end_requested_at: new Date().toISOString(),
      end_reason: parsed.data.reason ?? null,
    });

    if (isKinglancer) {
      if (orgOwner) {
        void notifyRoleEndProposed({
          recipientId: orgOwner.userId,
          recipientEmail: orgOwner.email ?? undefined,
          jobTitle,
          proposedBy: "The Kinglancer",
          link: orgLink,
        }).catch(() => {});
      }
    } else {
      void notifyRoleEndProposed({
        recipientId: engagement.kinglancer_id,
        recipientEmail: kinglancer?.email ?? undefined,
        jobTitle,
        proposedBy: "The organisation",
        link: kinglancerLink,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "decline") {
    if (!hasRequest) {
      return NextResponse.json(
        { error: "There's no pending request to end this role." },
        { status: 409 },
      );
    }
    await updateEngagement(engagement.id, {
      end_requested_by: null,
      end_requested_at: null,
      end_reason: null,
    });

    if (proposerIsKinglancer) {
      void notifyRoleEndDeclined({
        recipientId: engagement.kinglancer_id,
        recipientEmail: kinglancer?.email ?? undefined,
        jobTitle,
        declinedBy: "The organisation",
        link: kinglancerLink,
      }).catch(() => {});
    } else if (orgOwner) {
      void notifyRoleEndDeclined({
        recipientId: orgOwner.userId,
        recipientEmail: orgOwner.email ?? undefined,
        jobTitle,
        declinedBy: "The Kinglancer",
        link: orgLink,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  }

  if (parsed.data.action === "escalate") {
    const organisationName = await getOrganisationName(engagement.organisation_id);
    void notifyAdminRoleEndDispute({
      jobTitle,
      organisationName: organisationName ?? "an organisation",
      raisedBy: isKinglancer ? "The Kinglancer" : "The organisation",
      reason: parsed.data.reason ?? engagement.end_reason ?? "",
    }).catch((err) => console.error("[role end] escalate notify failed:", err));
    return NextResponse.json({ ok: true });
  }

  // confirm — only the party who didn't propose can confirm.
  if (!hasRequest) {
    return NextResponse.json(
      { error: "There's no request to confirm." },
      { status: 409 },
    );
  }
  const iAmProposer =
    (isKinglancer && proposerIsKinglancer) ||
    (isOrgManager && !proposerIsKinglancer);
  if (iAmProposer) {
    return NextResponse.json(
      { error: "The other party needs to confirm ending the role." },
      { status: 403 },
    );
  }

  await updateEngagement(engagement.id, {
    status: "ended",
    ended_at: new Date().toISOString(),
    end_requested_by: null,
    end_requested_at: null,
  });
  await settleEngagementPaymentsOnEarlyEnd(
    engagement.id,
    "Role ended early by mutual agreement",
  );

  void notifyRoleEnded({
    recipientId: engagement.kinglancer_id,
    recipientEmail: kinglancer?.email ?? undefined,
    jobTitle,
    link: kinglancerLink,
  }).catch(() => {});
  if (orgOwner) {
    void notifyRoleEnded({
      recipientId: orgOwner.userId,
      recipientEmail: orgOwner.email ?? undefined,
      jobTitle,
      link: orgLink,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}

async function getOrganisationName(organisationId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data } = await db
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .maybeSingle();
  return data?.name ?? null;
}
