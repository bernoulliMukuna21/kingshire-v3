import { NextResponse } from "next/server";
import { authoriseAgreement } from "@/lib/placement-access";
import { createCheckIn } from "@/lib/db/placements";
import { createServiceClient } from "@/lib/supabase/service";
import { notifyPlacementCheckIn } from "@/lib/notifications";

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

  // Notify the other party (fire-and-forget).
  const svc = createServiceClient();
  const { data: placement } = await svc
    .from("placements")
    .select("title, created_by")
    .eq("id", access.agreement.placement_id)
    .maybeSingle();
  const recipientId = access.isKinglancer
    ? placement?.created_by
    : access.agreement.kinglancer_id;
  if (placement && recipientId) {
    const [{ data: recipient }, { data: author }] = await Promise.all([
      svc.from("profiles").select("email").eq("id", recipientId).maybeSingle(),
      svc
        .from("profiles")
        .select("full_name")
        .eq("id", access.userId)
        .maybeSingle(),
    ]);
    void notifyPlacementCheckIn({
      recipientId,
      recipientEmail: recipient?.email ?? undefined,
      placementTitle: placement.title,
      agreementId,
      authorName: author?.full_name ?? "Someone",
    }).catch((err) =>
      console.error("[placements/check-ins] notify failed:", err),
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
