import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  activateAgreement,
  getAgreement,
  updateAgreementStatus,
} from "@/lib/db/placements";
import { ensurePaymentSchedule } from "@/lib/db/placement-payments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
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
  const action = (body as { action?: unknown }).action;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const agreement = await getAgreement(agreementId);
  if (!agreement || agreement.kinglancer_id !== user.id) {
    return NextResponse.json(
      { error: "Agreement not found." },
      { status: 404 },
    );
  }
  if (agreement.status !== "pending_acceptance") {
    return NextResponse.json(
      { error: "This agreement can no longer be changed." },
      { status: 409 },
    );
  }

  if (action === "accept") {
    const activated = await activateAgreement(agreementId);
    if (!activated) {
      return NextResponse.json(
        { error: "This agreement can no longer be accepted." },
        { status: 409 },
      );
    }
    // Managed placements start their monthly payment schedule on acceptance.
    if (agreement.payment_mode === "managed" && agreement.monthly_amount) {
      await ensurePaymentSchedule(agreement).catch((err) =>
        console.error("[placements] payment schedule failed:", err),
      );
    }
    return NextResponse.json({ ok: true });
  }

  await updateAgreementStatus(agreementId, "cancelled");
  return NextResponse.json({ ok: true });
}
