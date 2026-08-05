import { NextResponse } from "next/server";
import { authoriseAgreement } from "@/lib/placement-access";
import { createCheckIn } from "@/lib/db/placements";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;
  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  if (access.agreement.status !== "active") {
    return NextResponse.json(
      { error: "Check-ins are only available on an active placement." },
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

  await createCheckIn({ agreementId, authorId: access.userId, note });
  return NextResponse.json({ ok: true }, { status: 201 });
}
