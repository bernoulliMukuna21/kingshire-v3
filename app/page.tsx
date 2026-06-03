import HeroSection from "@/components/home/HeroSection";
import SkillsMarquee from "@/components/home/SkillsMarquee";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import TopKinglancers from "@/components/home/TopKinglancers";
import CtaBanner from "@/components/home/CtaBanner";
import PublicShell from "@/components/ui/PublicShell";

export default function HomePage() {
  return (
    <PublicShell>
      <HeroSection />
      <SkillsMarquee />
      <HowItWorks />
      <TrustSection />
      <TopKinglancers />
      <CtaBanner />
    </PublicShell>
  );
}
