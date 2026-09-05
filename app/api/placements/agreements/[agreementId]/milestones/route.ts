import { NextResponse } from "next/server";
import { authoriseAgreement } from "@/lib/placement-access";
import { createMilestone } from "@/lib/db/placements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (!access.isOrgManager) {
    return NextResponse.json(
      { error: "Only the organisation can add milestones." },
      { status: 403 },
    );
  }
  if (access.agreement.status !== "active") {
    return NextResponse.json(
      { error: "Milestones can only be added to an active placement." },
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
  const description =
    typeof b.description === "string" && b.description.trim()
      ? b.description.trim()
      : null;
  const dueDate =
    typeof b.due_date === "string" && b.due_date.trim() ? b.due_date : null;

  if (title.length < 2 || title.length > 200) {
    return NextResponse.json(
      { error: "Milestone title must be between 2 and 200 characters." },
      { status: 400 },
    );
  }
  if (dueDate && Number.isNaN(Date.parse(dueDate))) {
    return NextResponse.json({ error: "Invalid due date." }, { status: 400 });
  }

  await createMilestone({ agreementId, title, description, dueDate });
  return NextResponse.json({ ok: true }, { status: 201 });
}
