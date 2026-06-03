import { ChevronRight } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import { createClient } from "@/lib/supabase/server";

const CLIENT_STEPS = [
  {
    num: "01",
    title: "Post a Job",
    desc: "Describe what you need, set your budget and deadline. Your job goes live instantly.",
  },
  {
    num: "02",
    title: "Review Applicants",
    desc: "Kinglancers from your community apply. Review their profiles and pick the right person.",
  },
  {
    num: "03",
    title: "Pay Securely",
    desc: "Pay upfront into secure escrow. Your money is protected until the work is done.",
  },
  {
    num: "04",
    title: "Approve & Release",
    desc: "Once you are happy with the work, approve it and the Kinglancer gets paid instantly.",
  },
];

const KINGLANCER_STEPS = [
  {
    num: "01",
    title: "Browse Jobs",
    desc: "Explore jobs posted by people in your community that match your skills.",
  },
  {
    num: "02",
    title: "Send a Proposal",
    desc: "Write a short cover letter and set your rate. It only takes a minute.",
  },
  {
    num: "03",
    title: "Get Selected",
    desc: "The client reviews proposals and picks the best fit. You get notified right away.",
  },
  {
    num: "04",
    title: "Complete & Get Paid",
    desc: "Do the work, submit it, and once the client approves you get paid instantly.",
  },
];

export default async function HowItWorks() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = data?.role ?? null;
  }

  const steps = role === "kinglancer" ? KINGLANCER_STEPS : CLIENT_STEPS;
  const subtitle =
    role === "kinglancer"
      ? "Four steps to finding work and getting paid."
      : "Four steps. Fully protected. Built on trust.";

  return (
    <section id="how-it-works" className="py-16 md:py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-10 md:mb-16">
          <p className="text-blue-600 font-semibold text-sm tracking-widest uppercase mb-3">
            Simple by design
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight">
            How KingsHire works
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
            {subtitle}
          </p>
        </FadeIn>

        <Stagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
          {steps.map((step, i) => (
            <StaggerItem key={step.num} className="h-full">
              <div className="group relative bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50 transition-all duration-300 hover:-translate-y-1 h-full">
                <div className="text-5xl font-black text-blue-50 group-hover:text-blue-100 transition-colors mb-4 leading-none">
                  {step.num}
                </div>
                <h3 className="font-bold text-gray-900 text-lg mb-2">
                  {step.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {step.desc}
                </p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 -right-3 z-10">
                    <ChevronRight size={20} className="text-gray-300" />
                  </div>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
