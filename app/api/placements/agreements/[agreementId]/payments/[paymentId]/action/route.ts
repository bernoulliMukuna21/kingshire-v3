import { NextResponse } from "next/server";
import { z } from "zod";
import { authoriseAgreement } from "@/lib/placement-access";
import {
  getPlacementPayment,
  updatePlacementPaymentStatus,
} from "@/lib/db/placement-payments";
import { firePlacementPayout } from "@/lib/placement-payouts";
import { getPlacementTitle } from "@/lib/db/placements";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { notifyAdminPlacementDispute } from "@/lib/notifications";

const schema = z.object({
  action: z.enum(["approve", "dispute"]),
  reason: z.string().trim().max(2000).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string; paymentId: string }> },
) {
  const { agreementId, paymentId } = await params;

  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Only the organisation controls approvals/disputes on its payments.
  if (!access.isOrgManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const payment = await getPlacementPayment(paymentId);
  if (!payment || payment.agreement_id !== agreementId) {
    return NextResponse.json({ error: "Payment not found." }, { status: 404 });
  }
  if (payment.status !== "held") {
    return NextResponse.json(
      { error: "Only a held month can be approved or disputed." },
      { status: 409 },
    );
  }

  if (parsed.data.action === "approve") {
    // Release the held escrow to the Kinglancer now, ahead of month-end.
    await firePlacementPayout(payment);
    return NextResponse.json({ ok: true });
  }

  // dispute — hold for admin resolution.
  await updatePlacementPaymentStatus(paymentId, {
    status: "disputed",
    dispute_reason: parsed.data.reason ?? null,
  });

  const [placementTitle, organisationName] = await Promise.all([
    getPlacementTitle(access.agreement.placement_id),
    getOrganisationName(access.agreement.organisation_id),
  ]);
  void notifyAdminPlacementDispute({
    placementTitle: placementTitle ?? "a placement",
    organisationName: organisationName ?? "an organisation",
    periodIndex: payment.period_index,
    reason: parsed.data.reason ?? "(no reason given)",
  }).catch((err) =>
    console.error("[placement dispute] notify failed:", err),
  );

  return NextResponse.json({ ok: true });
}
