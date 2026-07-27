import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ORGANISATION_SETUP_PATH = "/organisation/setup";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-up?intent=organisation");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    redirect(ORGANISATION_SETUP_PATH);
  }

  redirect(ORGANISATION_SETUP_PATH);
}
