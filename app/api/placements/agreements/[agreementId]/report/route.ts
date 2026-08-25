import { NextResponse } from "next/server";
import { z } from "zod";
import { authoriseAgreement } from "@/lib/placement-access";
import { createServiceClient } from "@/lib/supabase/service";
import { getPlacementTitle } from "@/lib/db/placements";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { notifyAdminPlacementIssue } from "@/lib/notifications";

const bodySchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ agreementId: string }> },
) {
  const { agreementId } = await params;

  const access = await authoriseAgreement(agreementId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Only the participant can report an issue with their placement.
  if (!access.isKinglancer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please describe the issue (5–2000 characters)." },
      { status: 400 },
    );
  }

  const { agreement } = access;
  const db = createServiceClient();
  const [placementTitle, organisationName, { data: profile }] =
    await Promise.all([
      getPlacementTitle(agreement.placement_id),
      getOrganisationName(agreement.organisation_id),
      db
        .from("profiles")
        .select("full_name, email")
        .eq("id", agreement.kinglancer_id)
        .maybeSingle(),
    ]);

  // Fire-and-forget: a slow email must not hang the response.
  void notifyAdminPlacementIssue({
    placementTitle: placementTitle ?? "a placement",
    organisationName: organisationName ?? "an organisation",
    kinglancerName: profile?.full_name ?? "A Kinglancer",
    kinglancerEmail: profile?.email ?? "unknown",
    reason: parsed.data.reason,
  }).catch((err) =>
    console.error("[placements/report] notify failed:", err),
  );

  return NextResponse.json({ ok: true });
}
