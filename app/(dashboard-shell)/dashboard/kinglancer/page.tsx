import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10 space-y-6">
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
