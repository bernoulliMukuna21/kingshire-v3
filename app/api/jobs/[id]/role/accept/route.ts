import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagementBySource } from "@/lib/db/engagements";
import { ensureEngagementSchedule } from "@/lib/settlement/schedules";
import { meetsMinimumPeriodCharge } from "@/lib/settlement/fees";
import { requireTermsAccepted } from "@/lib/terms";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!(await requireTermsAccepted(user.id))) {
    return NextResponse.json(
      {
        error: "Please accept our updated terms to continue.",
        needsTerms: true,
      },
      { status: 403 },
    );
  }

  const engagement = await getEngagementBySource("org_role", jobId);
  if (!engagement || engagement.kinglancer_id !== user.id) {
    return NextResponse.json(
      { error: "Role engagement not found." },
      { status: 404 },
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
  const action =
    body && typeof body === "object"
      ? (body as { action?: unknown }).action
      : null;
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  if (
    action === "accept" &&
    (engagement.amount_per_period == null ||
      !meetsMinimumPeriodCharge(
        Number(engagement.amount_per_period),
        engagement.settlement_mode,
      ))
  ) {
    return NextResponse.json(
      {
        error:
          "This role's pay is too low to bill automatically. Contact support.",
      },
      { status: 400 },
    );
  }
  const { data: responded, error } = await createServiceClient().rpc(
    "respond_role_offer",
    {
      p_engagement_id: engagement.id,
      p_worker_id: user.id,
      p_action: action,
    },
  );
  if (error)
    return NextResponse.json(
      { error: "The offer could not be updated. Refresh and retry." },
      { status: 409 },
    );
  if (action === "accept") {
    try {
      await ensureEngagementSchedule(engagement.id, 1);
    } catch (error) {
      console.error("[role/accept] schedule", error);
      return NextResponse.json(
        {
          error:
            "Accepted, but payment setup needs another attempt. Please retry.",
        },
        { status: 503 },
      );
    }
  }
  return NextResponse.json({ ok: true, status: responded.status });
}
