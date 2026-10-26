import OrganisationDemo from "@/components/home/OrganisationDemo";
import HeroSection from "@/components/home/HeroSection";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import TopKinglancers from "@/components/home/TopKinglancers";
import CtaBanner from "@/components/home/CtaBanner";
import PublicShell from "@/components/ui/PublicShell";
import { formatMilestoneCount } from "@/lib/format-stats";
import { getHomepageProgress } from "@/lib/home-progress";

export const revalidate = 3600;

export default async function HomePage() {
  const progress = await getHomepageProgress();
  const { peopleCount, jobsCount, kinglancersCount } = progress;

  return (
    <PublicShell>
      <HeroSection
        progress={progress}
        stats={[
          {
            value:
              peopleCount === null ? "—" : formatMilestoneCount(peopleCount),
            label:
              peopleCount === 1 ? "Person registered" : "People registered",
          },
          {
            value: jobsCount === null ? "—" : formatMilestoneCount(jobsCount),
            label: jobsCount === 1 ? "Job posted" : "Jobs posted",
          },
          {
            value:
              kinglancersCount === null
                ? "—"
                : formatMilestoneCount(kinglancersCount),
            label:
              kinglancersCount === 1
                ? "Kinglancer available"
                : "Kinglancers available",
          },
        ]}
      />
      <HowItWorks />
      <OrganisationDemo />
      <TrustSection />
      <TopKinglancers />
      <CtaBanner />
    </PublicShell>
  );
}
