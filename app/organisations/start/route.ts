import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const CREATE_ORGANISATION_PATH = "/dashboard/organisations/new";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/sign-up?intent=organisation&role=client&next=${encodeURIComponent(CREATE_ORGANISATION_PATH)}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    redirect(
      `/onboarding?intent=organisation&role=client&next=${encodeURIComponent(CREATE_ORGANISATION_PATH)}`,
    );
  }

  redirect(CREATE_ORGANISATION_PATH);
}
