import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  ShieldCheck,
  Users,
} from "lucide-react";
import PublicShell from "@/components/ui/PublicShell";
import { ORGANISATION_PLANS } from "@/modules/organisations/domain/plans";

const BUSINESS_TEAM_IMAGE =
  "https://images.unsplash.com/photo-1753162660943-ce96a8953e8d?auto=format&fit=crop&w=1600&q=82";
const COMMUNITY_TEAM_IMAGE =
  "https://images.unsplash.com/photo-1544928147-79a2dbc1f389?auto=format&fit=crop&w=1200&q=82";

const benefits = [
  {
    icon: Building2,
    title: "Publish with your Organisation identity",
    text: "Build a clear profile and post paid jobs under the name people recognise.",
  },
  {
    icon: Users,
    title: "Give your team the right access",
    text: "Invite colleagues as Owner, Admin or Member without sharing a login.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Manage hiring in one place",
    text: "Keep Organisation jobs, applicants and transactions together.",
  },
  {
    icon: ShieldCheck,
    title: "Know who took each action",
    text: "Every team member uses an individual account, preserving accountability.",
  },
];

export default function OrganisationPage() {
  return (
    <PublicShell navbarVariant="solid">
      <section className="bg-white px-6 pb-20 pt-28">
        <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
              KingsHire for Organisations
            </p>
            <h1 className="mt-5 text-5xl font-extrabold leading-[1.06] tracking-[-0.04em] text-slate-950 sm:text-6xl">
              Create opportunities as a team.
            </h1>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              A shared KingsHire workspace for companies, charities, churches,
              non-profits, community groups and public bodies.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/organisation/start"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white transition hover:bg-blue-700"
              >
                Create your Organisation <ArrowRight size={18} />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-7 py-4 font-bold text-slate-800 transition hover:border-blue-400 hover:text-blue-700"
              >
                Sign in
              </Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              You will first create the personal Client account that securely
              owns your Organisation. Existing KingsHire users keep their
              current account.
            </p>
          </div>

          <div className="relative h-[460px] overflow-hidden rounded-[2rem] bg-slate-100 sm:h-[560px]">
            <Image
              src={BUSINESS_TEAM_IMAGE}
              alt="Two people collaborating in a small clothing business"
              fill
              preload
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 to-transparent p-8 pt-24 text-white">
              <p className="max-w-md text-lg font-bold">
                Built for real teams doing real work.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[0.72fr_1.28fr]">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
                One workspace
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                More than an individual Client account
              </h2>
              <p className="mt-4 leading-7 text-slate-600">
                Your Organisation has its own identity and shared work, while
                every person remains individually accountable.
              </p>
            </div>
            <div className="divide-y divide-slate-200 border-y border-slate-200">
              {benefits.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="grid gap-3 py-6 sm:grid-cols-[auto_1fr] sm:gap-5"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-950">
                      {title}
                    </h3>
                    <p className="mt-1 leading-7 text-slate-600">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
              Simple monthly plans
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Start with the workspace that fits your team
            </h2>
            <p className="mt-4 leading-7 text-slate-600">
              Every plan includes the shared workspace, your team, and unlimited
              organisation-owned paid job posts, plus experience placements with
              the Placement Passport.
            </p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {ORGANISATION_PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-[1.75rem] border p-6 ${
                  plan.highlighted
                    ? "border-blue-500 bg-blue-50 shadow-xl shadow-blue-950/10"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="font-extrabold text-slate-950">{plan.name}</p>
                <p className="mt-3 text-4xl font-extrabold text-slate-950">
                  £{plan.monthlyPriceGBP}
                  <span className="text-sm font-semibold text-slate-500">
                    /month
                  </span>
                </p>
                <p className="mt-3 min-h-14 text-sm leading-6 text-slate-600">
                  {plan.description}
                </p>
                <ul className="mt-5 space-y-3">
                  {[
                    `Up to ${plan.entitlements.teammates} teammates, plus the Owner`,
                    `${plan.entitlements.volunteerSchemes} active volunteer ${plan.entitlements.volunteerSchemes === 1 ? "scheme" : "schemes"}`,
                    `${plan.entitlements.paidPlacements} active paid placement listings`,
                    `${plan.entitlements.activeParticipants} active placement participants`,
                    `${plan.entitlements.reporting} reporting`,
                    ...plan.features,
                  ].map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-sm text-slate-700"
                    >
                      <Check
                        size={16}
                        className="mt-0.5 shrink-0 text-emerald-600"
                      />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-8 max-w-4xl rounded-2xl bg-slate-50 p-5 text-left text-sm leading-6 text-slate-600">
            <p>
              <strong className="text-slate-900">Active listing:</strong>{" "}
              accepting applications or currently in progress.{" "}
              <strong className="text-slate-900">Active participant:</strong>{" "}
              one person currently undertaking a placement.
            </p>
            <p className="mt-2">
              A volunteer scheme is a structured non-salaried opportunity with
              its remuneration, development and agreed outcomes declared before
              application.
            </p>
          </div>
          <div className="mt-9 text-center">
            <Link
              href="/organisation/start"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white transition hover:bg-blue-700"
            >
              Set up your Organisation <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div className="relative h-[520px] overflow-hidden rounded-[2rem]">
            <Image
              src={COMMUNITY_TEAM_IMAGE}
              alt="A community group creating floral arrangements together"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="max-w-xl">
            <p className="flex items-center gap-2 text-sm font-bold text-emerald-700">
              <BadgeCheck size={19} /> The next KingsHire opportunity
            </p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
              Structured placements with outcomes made clear
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              We are designing placements where remuneration, references,
              certifications and other agreed outcomes are declared before
              someone applies.
            </p>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Placements and Organisation verification are coming later.
              Subscription plans are now part of Organisation setup.
            </p>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
