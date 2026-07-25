import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import PublicShell from "@/components/ui/PublicShell";

const features = [
  {
    icon: Building2,
    title: "Build your Organisation presence",
    text: "Create a profile and publish opportunities under your Organisation's name.",
  },
  {
    icon: Users,
    title: "Work together",
    text: "Invite your team and assign Owner, Admin or Member permissions.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Manage paid jobs",
    text: "Post ordinary paid jobs and manage applicants from one shared workspace.",
  },
  {
    icon: ShieldCheck,
    title: "Keep control",
    text: "Every action belongs to an individual account, giving your team clear accountability.",
  },
];

export default function ForOrganisationsPage() {
  return (
    <PublicShell navbarVariant="solid">
      <section className="relative overflow-hidden bg-[#10234b] px-6 pb-20 pt-32 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.45),transparent_45%)]" />
        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-400/10 px-4 py-2 text-sm font-bold text-blue-200">
              <Sparkles size={16} /> KingsHire for Organisations
            </p>
            <h1 className="mt-6 text-4xl font-black leading-tight sm:text-6xl">
              Create opportunities.
              <br />
              Grow people. Work as a team.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/70">
              A dedicated workspace for companies, charities, churches,
              non-profits, community groups and public bodies using KingsHire.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/organisations/start"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 py-4 font-bold text-white transition hover:bg-blue-500"
              >
                Create your Organisation <ArrowRight size={18} />
              </Link>
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-7 py-4 font-bold text-white transition hover:bg-white/15"
              >
                Sign in to your workspace
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/55">
              New to KingsHire? You will first create the personal Client
              account that securely owns and manages your Organisation.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-widest text-blue-600">
              Built for shared work
            </p>
            <h2 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">
              More than an individual Client account
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-xl font-black text-slate-950">{title}</h3>
                <p className="mt-2 leading-7 text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-blue-50 px-6 py-16">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 rounded-3xl bg-white p-8 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-bold text-emerald-700">
              <BadgeCheck size={20} /> Coming after the foundation
            </p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Structured placements and Organisation plans
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              We are building placements with clearly declared remuneration,
              outcomes and agreements. Subscription plans and verification
              will follow; these features are not yet available.
            </p>
          </div>
          <Link
            href="/organisations/start"
            className="shrink-0 rounded-xl bg-blue-600 px-6 py-3.5 text-center text-sm font-bold text-white hover:bg-blue-700"
          >
            Create your workspace
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
