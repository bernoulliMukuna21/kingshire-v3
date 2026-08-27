import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserOrganisationSummaries } from "@/infrastructure/supabase/queries/organisation-queries";

export type DashboardProfile = {
  full_name: string | null;
  role: string | null;
  avatar_url: string | null;
  rating: number;
  jobs_completed: number;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  bio: string | null;
  services: Array<{ name: string; rate: number; rate_type: string }> | null;
  terms_accepted_version: number;
};

export const getDashboardContext = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, role, avatar_url, rating, jobs_completed, stripe_account_id, stripe_onboarding_complete, bio, services, terms_accepted_version"
    )
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/sign-in");
  if (profile.role === "admin") redirect("/admin");
  if (!profile.role) redirect("/onboarding");

  const organisations = await getUserOrganisationSummaries(user.id, 5);

  return { supabase, user, profile: profile as DashboardProfile, organisations };
});
