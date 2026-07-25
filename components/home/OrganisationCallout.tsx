import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, Users } from "lucide-react";

export default function OrganisationCallout() {
  return (
    <section className="relative z-10 -mt-10 px-4 sm:px-6">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl shadow-slate-900/10">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white sm:flex">
              <Building2 size={28} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
                KingsHire for Organisations
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
                Hiring or creating opportunities as a team?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Create an Organisation workspace, publish under your
                Organisation&apos;s name and invite colleagues to work together.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-slate-700">
                <span className="flex items-center gap-1.5"><CheckCircle2 size={16} className="text-emerald-500" />Organisation profile</span>
                <span className="flex items-center gap-1.5"><Users size={16} className="text-emerald-500" />Team permissions</span>
              </div>
            </div>
          </div>
          <Link
            href="/for-organisations"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Explore for Organisations <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
