import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// POST /api/profile/complete-onboarding
// Persists the onboarding form. Uses the service client so that the profile
// trigger does not revert the `role` field (the trigger blocks authenticated-
// role writes to system-managed columns, but service role bypasses it).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { role, phone, service_tags, portfolio_url, cv_url } = body;

  if (role !== "client" && role !== "kinglancer") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (
    role === "kinglancer" &&
    (!Array.isArray(service_tags) || service_tags.length === 0)
  ) {
    return NextResponse.json(
      { error: "Please select at least one service." },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const { error } = await db
    .from("profiles")
    .update({
      role,
      phone: phone || null,
      service_tags: role === "kinglancer" ? service_tags : [],
      portfolio_url: portfolio_url || null,
      cv_url: cv_url || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[complete-onboarding]", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
