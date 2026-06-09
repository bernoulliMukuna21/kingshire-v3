export const dynamic = "force-dynamic";

import HeroSection from "@/components/home/HeroSection";
import ServicesMarquee from "@/components/home/ServicesMarquee";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import TopKinglancers from "@/components/home/TopKinglancers";
import CtaBanner from "@/components/home/CtaBanner";
import PublicShell from "@/components/ui/PublicShell";
import { formatMilestoneCount } from "@/lib/format-stats";
import { createServiceClient } from "@/lib/supabase/service";

export default async function HomePage() {
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

  const peopleCount = profilesResult.count ?? 0;
  const jobsCount = jobsResult.count ?? 0;
  const kinglancersCount = kinglancersResult.count ?? 0;

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
      <ServicesMarquee />
      <HowItWorks />
      <TrustSection />
      <TopKinglancers />
      <CtaBanner />
    </PublicShell>
  );
}
