import { unstable_cache } from "next/cache";
import HeroSection from "@/components/home/HeroSection";
import ServicesMarquee from "@/components/home/ServicesMarquee";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import TopKinglancers from "@/components/home/TopKinglancers";
import CtaBanner from "@/components/home/CtaBanner";
import OrganisationCallout from "@/components/home/OrganisationCallout";
import PublicShell from "@/components/ui/PublicShell";
import { formatMilestoneCount } from "@/lib/format-stats";
import { createServiceClient } from "@/lib/supabase/service";

// Revalidate the whole page at most every 5 minutes
export const revalidate = 3600; // 1 hour — social proof stats, staleness is invisible

const getHomepageStats = unstable_cache(
  async () => {
    const serviceDb = createServiceClient();
    const [profilesResult, jobsResult, kinglancersResult] = await Promise.all([
      serviceDb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .or("role.is.null,role.neq.admin"),
      serviceDb.from("jobs").select("id", { count: "exact", head: true }),
      serviceDb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "kinglancer"),
    ]);
    return {
      peopleCount: profilesResult.count ?? 0,
      jobsCount: jobsResult.count ?? 0,
      kinglancersCount: kinglancersResult.count ?? 0,
    };
  },
  ["homepage-stats"],
  { revalidate: 3600 },
);

export default async function HomePage() {
  const { peopleCount, jobsCount, kinglancersCount } = await getHomepageStats();

  return (
    <PublicShell>
      <HeroSection
        stats={[
          {
            value: formatMilestoneCount(peopleCount),
            label:
              peopleCount === 1 ? "Person registered" : "People registered",
          },
          {
            value: formatMilestoneCount(jobsCount),
            label: jobsCount === 1 ? "Job posted" : "Jobs posted",
          },
          {
            value: formatMilestoneCount(kinglancersCount),
            label:
              kinglancersCount === 1
                ? "Kinglancer available"
                : "Kinglancers available",
          },
        ]}
      />
      <OrganisationCallout />
      <ServicesMarquee />
      <HowItWorks />
      <TrustSection />
      <TopKinglancers />
      <CtaBanner />
    </PublicShell>
  );
}
