"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle, LayoutDashboard } from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";
import OrganisationAnnouncement from "@/components/home/OrganisationAnnouncement";

const WORKER_IMAGE =
  "https://images.unsplash.com/photo-1615506355925-dd0a54d099dd?auto=format&fit=crop&w=1400&q=82";

const trustBadges = [
  "Stripe-secured payments",
  "Real community profiles",
  "Free to join",
  "Low platform fees",
];

type HeroStat = {
  value: string;
  label: string;
};

export default function HeroSection({ stats }: { stats: HeroStat[] }) {
  const { isLoggedIn, role, dashboardHref } = usePublicAuth();
  const secondaryCta =
    role === "client"
      ? { href: "/jobs/post", label: "Post a job" }
      : { href: "/jobs", label: "Browse jobs" };

  return (
    <section className="relative overflow-hidden bg-[#10234b] pt-16 text-white">
      <OrganisationAnnouncement />
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.04fr_0.96fr] lg:py-20">
        <div className="relative z-10 max-w-2xl">
          <p className="mb-5 text-sm font-bold uppercase tracking-[0.18em] text-blue-300">
            Local work. Real people. Fair payment.
          </p>
          <h1 className="text-5xl font-extrabold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            Hire trusted skills.
            <span className="mt-2 block text-blue-400">
              Earn from yours.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-white/68">
            KingsHire connects people who need work done with people ready to
            do it—from cleaning and repairs to design and professional
            services.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {isLoggedIn ? (
              <>
                <Link
                  href={dashboardHref}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white transition hover:bg-blue-500"
                >
                  <LayoutDashboard size={18} />
                  Go to dashboard
                </Link>
                <Link
                  href={secondaryCta.href}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-7 py-4 font-bold text-white transition hover:bg-white/10"
                >
                  {secondaryCta.label} <ArrowRight size={18} />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-up?role=client"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white transition hover:bg-blue-500"
                >
                  Post a job <ArrowRight size={18} />
                </Link>
                <Link
                  href="/sign-up?role=kinglancer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 px-7 py-4 font-bold text-white transition hover:bg-white/10"
                >
                  Offer your services <ArrowRight size={18} />
                </Link>
              </>
            )}
          </div>

          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-4">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-2xl font-extrabold">{stat.value}</p>
                <p className="mt-0.5 text-xs text-white/45">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-9 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/55">
            {trustBadges.map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <CheckCircle size={14} className="text-emerald-400" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative h-[380px] sm:h-[480px] lg:h-[650px]">
          <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
            <Image
              src={WORKER_IMAGE}
              alt="A professional cleaner preparing equipment while working"
              fill
              preload
              sizes="(max-width: 1024px) 100vw, 46vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#10234b]/45 via-transparent to-transparent" />
          </div>
          <div className="absolute bottom-6 left-6 right-6 border-l-2 border-blue-400 bg-[#10234b]/88 p-5 backdrop-blur-sm">
            <p className="text-sm font-bold text-white">
              Practical work belongs at the centre of the platform.
            </p>
            <p className="mt-1 text-xs leading-5 text-white/60">
              Find local opportunities or hire the skills your work requires.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
