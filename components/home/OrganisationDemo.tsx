"use client";
import Link from "next/link";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";
import { homeAudience, showOrganisationDemo } from "@/lib/home-news";
import { ArrowRight, Check, Play } from "lucide-react";
export default function OrganisationDemo() {
  const auth = usePublicAuth();
  if (!showOrganisationDemo(homeAudience(auth))) return null;
  return (
    <section className="bg-slate-50 px-6 py-16 sm:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-3xl bg-[#10234b] p-7 text-white sm:p-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
            For organisations
          </p>
          <h2 className="mt-4 text-3xl font-black leading-tight sm:text-4xl">
            Hiring for a team?
            <br />
            Let’s walk you through it.
          </h2>
          <p className="mt-5 max-w-lg leading-7 text-blue-100/80">
            See how to post work, review applicants and manage jobs together.
            We’ll show you the parts that matter to your organisation.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/contact?topic=demo"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-[#10234b]"
            >
              Request a demo
              <Play size={16} />
            </Link>
            <Link
              href="/organisation"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white ring-1 ring-white/25 hover:bg-white/10"
            >
              Explore organisation accounts
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/10">
          <p className="font-bold">A walkthrough built around your team</p>
          <ul className="mt-5 space-y-4 text-sm text-blue-100">
            {[
              "Post jobs under your organisation’s name",
              "Give colleagues their own access",
              "Keep applicants and payments in one place",
              "Ask questions and get help getting started",
            ].map((text) => (
              <li key={text} className="flex gap-3">
                <Check size={18} className="shrink-0 text-emerald-300" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
