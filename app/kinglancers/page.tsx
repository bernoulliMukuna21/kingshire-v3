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
        "id, full_name, avatar_url, service_tags, rating, jobs_completed, tagline, services, bio",
      )
      .eq("role", "kinglancer")
      .order("jobs_completed", { ascending: false })
      .limit(60);

    // Only surface profiles that have an about section and at least one priced
    // service — the minimum a client needs to make a booking decision.
    return (data ?? []).filter((k) => {
      const hasBio = !!k.bio?.trim();
      const hasPricedService = Array.isArray(k.services) &&
        (k.services as { rate: number }[]).some((s) => Number(s.rate) > 0);
      return hasBio && hasPricedService;
    });
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
