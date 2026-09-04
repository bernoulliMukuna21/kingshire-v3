import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  upsertPayoutAccount,
  deletePayoutAccount,
} from "@/lib/db/payout-accounts";
import { validatePayoutLink } from "@/lib/payout-links";

// POST /api/profile/payout-account — save the worker's payout link.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = typeof body.provider === "string" ? body.provider : "";
  const link = typeof body.link === "string" ? body.link : "";

  const result = validatePayoutLink(provider, link);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await upsertPayoutAccount(user.id, provider, result.link);
  return NextResponse.json({ success: true });
}

// DELETE /api/profile/payout-account — GDPR erasure of the payout link.
export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  await deletePayoutAccount(user.id);
  return NextResponse.json({ success: true });
}
