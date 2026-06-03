import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// POST /api/profile/switch-role — toggle between client and kinglancer
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, service_tags")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts cannot switch marketplace roles." },
      { status: 403 },
    );
  }

  const newRole = profile.role === "client" ? "kinglancer" : "client";

  // Switching into kinglancer requires service setup first.
  const hasServices =
    Array.isArray(profile.service_tags) && profile.service_tags.length > 0;
  if (newRole === "kinglancer" && !hasServices) {
    return NextResponse.json(
      {
        error: "Please complete your kinglancer setup first.",
        requires_setup: true,
        redirect:
          "/onboarding?from=switch&role=kinglancer&next=/dashboard/kinglancer",
      },
      { status: 400 },
    );
  }

  // Use service client so the profile trigger does not revert `role`
  const serviceDb = createServiceClient();
  const { error } = await serviceDb
    .from("profiles")
    .update({ role: newRole })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to switch role" },
      { status: 500 },
    );
  }

  const destination =
    newRole === "client" ? "/dashboard/client" : "/dashboard/kinglancer";

  return NextResponse.json({ role: newRole, redirect: destination });
}
