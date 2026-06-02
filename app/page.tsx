import Navbar from "@/components/Navbar";
import HeroSection from "@/components/home/HeroSection";
import SkillsMarquee from "@/components/home/SkillsMarquee";
import HowItWorks from "@/components/home/HowItWorks";
import TrustSection from "@/components/home/TrustSection";
import TopKinglancers from "@/components/home/TopKinglancers";
import CtaBanner from "@/components/home/CtaBanner";
import Footer from "@/components/Footer";

export default function HomePage() {
  return (
    <div className="bg-white overflow-x-hidden">
      <Navbar />
      <HeroSection />
      <SkillsMarquee />
      <HowItWorks />
      <TrustSection />
      <TopKinglancers />
      <CtaBanner />
      <Footer />
    </div>
  );
}
