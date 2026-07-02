import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ChevronRight } from "lucide-react";
import { FadeIn } from "@/components/animations";
import { getDashboardContext } from "@/lib/dashboard-context";
import {
  KinglancerStatsSection,
  KinglancerStatsSkeleton,
  KinglancerActionCentreSection,
  ActionCentreSkeleton,
} from "./_sections/KinglancerStatsSections";
import {
  KinglancerApplicationsSection,
  KinglancerApplicationsSkeleton,
} from "./_sections/KinglancerApplicationsSection";

export default async function KinglancerDashboard() {
  const { profile } = await getDashboardContext();

  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  const services = (profile.services ?? []) as Array<{
    name: string;
    rate: number;
    rate_type: string;
  }>;
  const isProfileComplete =
    !!profile.bio?.trim() && services.some((s) => Number(s.rate) > 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
      {!isProfileComplete && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-red-900">
              Complete your profile to apply for jobs
            </p>
            <p className="mt-0.5 text-sm text-red-700">
              Add an &ldquo;About you&rdquo; section and set a rate on at least
              one service before you can apply to jobs or receive direct
              requests.
            </p>
            <Link
              href="/dashboard/profile"
              className="mt-2 inline-block text-sm font-bold text-red-800 underline underline-offset-2 hover:text-red-900"
            >
              Complete your profile →
            </Link>
          </div>
        </div>
      )}
      <FadeIn className="relative overflow-hidden rounded-4xl bg-[#10234b] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_34%)]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-100 ring-1 ring-white/15">
              Kinglancer dashboard
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Welcome back, {firstName} 👋
            </h1>
            <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
              Track applications, manage active jobs, and monitor your earnings.
            </p>
          </div>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-[#10234b] shadow-xl shadow-slate-950/20 transition-all hover:-translate-y-0.5 hover:bg-sky-50"
          >
            Browse jobs
            <ChevronRight size={16} className="ml-1" />
          </Link>
        </div>
      </FadeIn>

      <Suspense fallback={<KinglancerStatsSkeleton />}>
        <KinglancerStatsSection />
      </Suspense>

      <Suspense fallback={<ActionCentreSkeleton />}>
        <KinglancerActionCentreSection />
      </Suspense>

      <Suspense fallback={<KinglancerApplicationsSkeleton />}>
        <KinglancerApplicationsSection />
      </Suspense>
    </div>
  );
}
