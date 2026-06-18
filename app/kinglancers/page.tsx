import { unstable_cache } from "next/cache";
import { FadeIn } from "@/components/animations";
import { createServiceClient } from "@/lib/supabase/service";
import KinglancersGrid from "./KinglancersGrid";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";

export const revalidate = 3600; // 1 hour safety net; profile saves trigger immediate revalidation

const getKinglancers = unstable_cache(
  async () => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, service_tags, rating, jobs_completed, tagline, services",
      )
      .eq("role", "kinglancer")
      .order("jobs_completed", { ascending: false })
      .limit(60);
    return data ?? [];
  },
  ["kinglancers-listing"],
  { revalidate: 3600, tags: ["kinglancer-profiles"] },
);

export default async function KinglancersPage() {
  const kinglancers = await getKinglancers();

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
