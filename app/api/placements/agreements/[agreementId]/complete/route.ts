import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authoriseAgreement } from "@/lib/placement-access";
import { deriveAgreementView } from "@/lib/placement-agreements";
import {
  completeAgreement,
  createExperienceRecord,
  getExperienceRecordByAgreement,
  placementPromisedReference,
} from "@/lib/db/placements";
import { getEngagementBySource, updateEngagement } from "@/lib/db/engagements";
import { cancelRemainingEngagementPayments } from "@/lib/settlement/termination";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }
  if (!access.isOrgManager) {
    return NextResponse.json(
      { error: "Only the organisation can complete a placement." },
      { status: 403 },
    );
  }

  // A prior attempt may have completed the agreement but failed before
  // writing the experience record — resume instead of rejecting as "not
  // active", and never write a second record for an already-finished one.
  const alreadyCompleted = access.agreement.status === "completed";
  if (alreadyCompleted) {
    const existing = await getExperienceRecordByAgreement(agreementId);
    if (existing) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }
  } else if (!deriveAgreementView(access.agreement).canComplete) {
    // Mirror the UI: can't complete unless it's active and not mid early-end.
    return NextResponse.json(
      { error: "This placement can't be completed right now." },
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
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const summary =
    typeof b.summary === "string" && b.summary.trim() ? b.summary.trim() : null;
  const outcome =
    typeof b.outcome === "string" && b.outcome.trim() ? b.outcome.trim() : null;
  const referenceText =
    typeof b.reference_text === "string" && b.reference_text.trim()
      ? b.reference_text.trim()
      : null;
  const isPublic = b.is_public !== false;
  const skills = Array.isArray(b.skills)
    ? (b.skills.filter((s) => typeof s === "string" && s.trim()) as string[])
        .map((s) => s.trim())
        .slice(0, 20)
    : [];

  if (title.length < 3 || title.length > 200) {
    return NextResponse.json(
      { error: "Give the experience record a title (3–200 characters)." },
      { status: 400 },
    );
  }

  // A promised reference must actually be written before completing.
  if (
    !referenceText &&
    (await placementPromisedReference(access.agreement.placement_id))
  ) {
    return NextResponse.json(
      {
        error:
          "This placement promised a reference — please write one before completing.",
      },
      { status: 400 },
    );
  }

  // Completing frees the participant seat and publishes the experience record.
  if (!alreadyCompleted) {
    const completed = await completeAgreement(agreementId);
    if (!completed) {
      return NextResponse.json(
        { error: "This placement is no longer active." },
        { status: 409 },
      );
    }
  }

  // The agreement and its underlying engagement are separate records —
  // without this, the engagement stays "active" forever, so a period still
  // scheduled past completion would keep getting charged. Any currently
  // held period is left alone (unlike early-end) — it's a legitimate final
  // month and should still release normally once its period ends. CAS on
  // "active" and only-cancel-not-yet-charged make this safe to repeat on a
  // resumed request.
  const engagement = await getEngagementBySource("placement", agreementId);
  if (engagement) {
    await updateEngagement(
      engagement.id,
      {
        status: "ended",
        ended_at: new Date().toISOString(),
        end_reason: "Placement completed",
      },
      "active",
    );
    await cancelRemainingEngagementPayments(engagement.id);
  }

  await createExperienceRecord({
    agreement: access.agreement,
    title,
    summary,
    skills,
    outcome,
    referenceText,
    isPublic,
  });
  if (isPublic) revalidateTag("kinglancer-experience", { expire: 0 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
