export const dynamic = "force-dynamic";

import { FadeIn } from "@/components/animations";
import { createClient } from "@/lib/supabase/server";
import KinglancersGrid from "./KinglancersGrid";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";

export default async function KinglancersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_url, service_tags, rating, jobs_completed, tagline, services",
    )
    .eq("role", "kinglancer")
    .order("jobs_completed", { ascending: false })
    .limit(60);

  const kinglancers = data ?? [];

  return (
    <PublicShell>
      <FadeIn>
        <PublicHero
          eyebrow="Community Talent"
          title="Our Kinglancers"
          description="Skilled, verified members of your community — ready to deliver."
        />
      </FadeIn>
      <KinglancersGrid kinglancers={kinglancers} />
    </PublicShell>
  );
}
