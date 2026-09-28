import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { reconcileSettlementOutcome } from "@/lib/settlement/reconciliation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  if (
    typeof body?.externalId !== "string" ||
    !/^(tr|re)_[A-Za-z0-9]+$/.test(body.externalId)
  ) {
    return NextResponse.json(
      { error: "An existing Stripe transfer/refund ID is required" },
      { status: 400 },
    );
  }
  try {
    const { paymentId } = await params;
    await reconcileSettlementOutcome(paymentId, body.externalId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[settlement reconciliation]", error);
    return NextResponse.json(
      {
        error:
          "Unable to verify and record that outcome. Check the payment and Stripe record.",
      },
      { status: 409 },
    );
  }
}
