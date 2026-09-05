import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { authoriseAgreement } from "@/lib/placement-access";
import { deriveAgreementView } from "@/lib/placement-agreements";
import {
  completeAgreement,
  createExperienceRecord,
  placementPromisedReference,
} from "@/lib/db/placements";

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
  // Mirror the UI: can't complete unless it's active and not mid early-end.
  if (!deriveAgreementView(access.agreement).canComplete) {
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
  const completed = await completeAgreement(agreementId);
  if (!completed) {
    return NextResponse.json(
      { error: "This placement is no longer active." },
      { status: 409 },
    );
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
