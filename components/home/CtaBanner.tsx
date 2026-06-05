"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { ScaleIn } from "@/components/animations";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";

export default function CtaBanner() {
  const { isLoggedIn, authReady, role, dashboardHref } = usePublicAuth();
  const isKinglancer = role === "kinglancer";

  let primaryBtn: React.ReactNode;
  let secondaryBtn: React.ReactNode;

  if (!authReady || !isLoggedIn) {
    // Logged-out (or pre-hydration): sign-up flows
    primaryBtn = (
      <Link
        href="/sign-up?role=client"
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white text-[#1a2e5a] font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base"
      >
        Post a Job
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
    secondaryBtn = (
      <Link
        href="/sign-up?role=kinglancer"
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
      >
        Become a Kinglancer
        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  } else if (isKinglancer) {
    // Kinglancers: show relevant actions, not sign-up CTAs
    primaryBtn = (
      <Link
        href="/jobs"
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white text-[#1a2e5a] font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base"
      >
        Browse Jobs
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
    secondaryBtn = (
      <Link
        href={dashboardHref}
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
      >
        Go to Dashboard
        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  } else {
    // Logged-in client
    primaryBtn = (
      <Link
        href="/jobs/post"
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white text-[#1a2e5a] font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl text-sm sm:text-base"
      >
        Post a Job
        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
    secondaryBtn = (
      <Link
        href="/dashboard/settings"
        className="group inline-flex items-center justify-center gap-2 px-6 py-3 sm:px-8 sm:py-4 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 text-sm sm:text-base"
      >
        Become a Kinglancer
        <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
      </Link>
    );
  }

  return (
    <section className="py-16 md:py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <ScaleIn>
          <div className="relative bg-linear-to-br from-[#1a2e5a] via-[#1e3a8a] to-[#1a2e5a] animate-gradient rounded-3xl p-8 sm:p-12 md:p-16 text-center overflow-hidden">
            <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400/20 rounded-full blur-3xl" />

            <div className="relative z-10">
              <p className="text-blue-300 font-semibold text-sm tracking-widest uppercase mb-4">
                Ready to get started?
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight mb-6">
                Join your community.
                <br />
                Build something real.
              </h2>
              <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
                Whether you have work to get done or services to offer —
                KingsHire is your platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {primaryBtn}
                {secondaryBtn}
              </div>
            </div>
          </div>
        </ScaleIn>
      </div>
    </section>
  );
}

