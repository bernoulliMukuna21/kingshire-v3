import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Briefcase, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BackButton from "./BackButton";
import { getJobById } from "@/lib/db/jobs";
import { getApplicationsByJob, hasApplied } from "@/lib/db/applications";
import type { ApplicationWithKinglancer } from "@/lib/db/applications";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";
import {
  ApplyForm,
  ApplicantsList,
  KinglancerCompleteButton,
  ClientApproveActions,
} from "./JobActions";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Phase 1: job fetch and auth check run in parallel
  const [
    job,
    {
      data: { user },
    },
  ] = await Promise.all([getJobById(id), supabase.auth.getUser()]);
  if (!job) notFound();

  const isOwner = user?.id === job.client_id;
  const isAssignedKinglancer = user?.id === job.kinglancer_id;

  let profile: {
    id: string;
    role: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null = null;
  let alreadyApplied = false;
  let applications: ApplicationWithKinglancer[] = [];

  if (user) {
    // Phase 2: profile, applications list (if owner), and hasApplied check all in parallel
    const [profileResult, applicationsResult, appliedResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id, role, full_name, avatar_url")
          .eq("id", user.id)
          .single(),
        isOwner
          ? getApplicationsByJob(id)
          : Promise.resolve([] as ApplicationWithKinglancer[]),
        hasApplied(id, user.id),
      ]);
    profile = profileResult.data;
    applications = applicationsResult;
    alreadyApplied = appliedResult;
  }

  const canApply =
    profile &&
    profile.role === "kinglancer" &&
    !isOwner &&
    job.status === "open" &&
    !alreadyApplied;

  const statusConfig: Record<string, { label: string; color: string }> = {
    open: {
      label: "Open for Applications",
      color: "bg-green-100 text-green-700",
    },
    in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700" },
    completed: { label: "Completed", color: "bg-gray-100 text-gray-600" },
    cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700" },
    disputed: { label: "Disputed", color: "bg-orange-100 text-orange-700" },
  };

  const s = statusConfig[job.status] ?? statusConfig.open;
  const rateType = job.rate_type ?? "fixed";
  const budgetSuffix =
    rateType === "per_hour"
      ? "/hr"
      : rateType === "per_day"
        ? "/day"
        : " (fixed)";
  const budgetNote =
    rateType === "fixed"
      ? "Fixed price held in escrow on selection"
      : rateType === "per_hour"
        ? "Hourly rate held in escrow on selection"
        : "Daily rate held in escrow on selection";

  const pageContent = (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <BackButton />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span
                className={`px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}
              >
                {s.label}
              </span>
            </div>

            <h1 className="text-xl font-black text-gray-900 mb-4">
              {job.title}
            </h1>

            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
              {job.description}
            </p>

            {(job.categories ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5">
                {job.categories.map((cat) => (
                  <span
                    key={cat}
                    className="bg-blue-50 text-blue-600 text-xs font-medium px-2.5 py-1 rounded-lg"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>

          {isOwner && job.status === "open" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-4">
                Applicants ({applications.length})
              </h2>
              <ApplicantsList applications={applications} jobId={id} />
            </div>
          )}

          {isAssignedKinglancer && job.status === "in_progress" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-1">Ready to submit?</h2>
              <p className="text-sm text-gray-500 mb-4">
                Once you mark your work as done, the client will be asked to
                review and approve it.
              </p>
              <KinglancerCompleteButton jobId={id} />
            </div>
          )}

          {isOwner && job.status === "completed" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-1">Work submitted</h2>
              <p className="text-sm text-gray-500 mb-4">
                The Kinglancer has marked this work as done. Review it and
                release the payment, or raise a dispute if something is wrong.
              </p>
              <ClientApproveActions jobId={id} showApprove={true} />
            </div>
          )}

          {isOwner && job.status === "in_progress" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-1">Job in progress</h2>
              <p className="text-sm text-gray-500 mb-4">
                Waiting for the Kinglancer to complete the work and submit it
                for review.
              </p>
              <ClientApproveActions jobId={id} showApprove={false} />
            </div>
          )}

          {!isOwner && job.status === "open" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h2 className="font-bold text-gray-900 mb-1">Apply</h2>
              {!user ? (
                <div className="text-sm text-gray-500 space-y-3 mt-3">
                  <p>Sign in to apply for this job.</p>
                  <Link
                    href="/sign-in"
                    className="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-all"
                  >
                    Sign in
                  </Link>
                </div>
              ) : alreadyApplied ? (
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 mt-3">
                  <span className="text-green-600 text-sm font-medium">
                    ✓ You have already applied to this job.
                  </span>
                </div>
              ) : canApply ? (
                <div className="mt-3">
                  <ApplyForm jobId={id} />
                </div>
              ) : profile?.role === "client" ? (
                <p className="text-sm text-gray-500 mt-3">
                  Switch your account to Kinglancer to apply for jobs.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Budget
            </p>
            <p className="text-3xl font-black text-green-600">
              £{Number(job.budget).toLocaleString()}
              <span className="text-base font-medium text-gray-500 ml-1">
                {budgetSuffix}
              </span>
            </p>
            <p className="text-xs text-gray-400 mt-1">{budgetNote}</p>
            {canApply && (
              <p className="text-xs text-gray-400 mt-3 border-t border-gray-50 pt-3">
                By applying you agree to complete this work for the budget
                stated above.
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            {job.deadline && (
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <span>
                  Deadline:{" "}
                  <strong>
                    {new Date(job.deadline).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </span>
              </div>
            )}
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Tag size={16} className="text-gray-400 shrink-0" />
              <span>{(job.categories ?? []).join(", ")}</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <Briefcase size={16} className="text-gray-400 shrink-0" />
              <span>
                Posted{" "}
                {new Date(job.created_at).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Posted by
            </p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden shrink-0">
                {job.client.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={job.client.avatar_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  job.client.full_name[0]?.toUpperCase()
                )}
              </div>
              <p className="font-semibold text-gray-900 text-sm">
                {job.client.full_name}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Logged-in users get the full dashboard shell
  if (profile) {
    const activeHref =
      profile.role === "kinglancer" ? "/jobs" : "/dashboard/client/jobs";
    return (
      <DashboardShell
        profile={profile}
        navItems={getNavItems(profile.role, activeHref)}
      >
        {pageContent}
      </DashboardShell>
    );
  }

  // Guest: minimal public header
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#0f172a] sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center">
          <Link href="/">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={120}
              height={36}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>
      </div>
      {pageContent}
    </div>
  );
}
