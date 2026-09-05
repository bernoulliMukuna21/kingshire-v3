import { NextResponse } from "next/server";
import { authoriseAgreement } from "@/lib/placement-access";
import { confirmMilestone, getMilestone } from "@/lib/db/placements";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ agreementId: string; milestoneId: string }> },
) {
  const { agreementId, milestoneId } = await params;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.isOrgManager) {
    return NextResponse.json(
      { error: "Only the organisation can confirm milestones." },
      { status: 403 },
    );
  }

  const milestone = await getMilestone(milestoneId);
  if (!milestone || milestone.agreement_id !== agreementId) {
    return NextResponse.json(
      { error: "Milestone not found." },
      { status: 404 },
    );
  }

  await confirmMilestone(milestoneId, access.userId);
  return NextResponse.json({ ok: true });
}
