import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

// POST /api/terms/accept — records the current user's acceptance of the latest
// platform terms.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { error } = await createServiceClient()
    .from("profiles")
    .update({
      terms_accepted_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[terms/accept]", error);
    return NextResponse.json(
      { error: "Could not save your acceptance. Please try again." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
