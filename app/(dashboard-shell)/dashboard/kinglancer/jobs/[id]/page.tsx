import { notFound, redirect } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Tag,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  getJobReviewState,
  isReviewWindowClosed,
  reviewWindowRemaining,
  REVIEW_WINDOW_DAYS,
} from "@/lib/db/reviews";
import { getTransactionByJob } from "@/lib/db/transactions";
import DashboardBackLink from "@/components/dashboard/DashboardBackLink";
import { Avatar } from "@/components/ui/Avatar";
import { Card, cardPadding } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ReviewPanel from "@/components/jobs/ReviewPanel";
import {
  DirectRequestActions,
  KinglancerCompleteButton,
} from "@/app/jobs/[id]/JobActions";

type JobWorkspace = {
  id: string;
  title: string;
  description: string;
  budget: number;
  rate_type: "fixed" | "per_hour" | "per_day";
  status:
    | "open"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "disputed"
    | "approved";
  deadline: string | null;
  categories: string[];
  client_id: string;
  kinglancer_id: string | null;
  invited_kinglancer_id: string | null;
  direct_request_status:
    | "pending"
    | "changes_requested"
    | "accepted_pending_payment"
    | "declined"
    | "cancelled"
    | null;
  direct_request_message: string | null;
  counter_budget: number | null;
  counter_rate_type: "fixed" | "per_hour" | "per_day" | null;
  counter_deadline: string | null;
  created_at: string;
  client: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

type Application = {
  id: string;
  status: "pending" | "accepted" | "rejected";
  cover_letter: string;
  created_at: string;
};

type Transaction = {
  amount: number;
  platform_fee_kinglancer: number;
  status: "pending" | "held" | "released" | "refunded" | "disputed";
};

const statusConfig: Record<string, { label: string; className: string }> = {
  in_progress: { label: "In progress", className: "bg-blue-100 text-blue-700" },
  completed: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-700",
  },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-700" },
  approved: { label: "Approved", className: "bg-green-100 text-green-700" },
  cancelled: { label: "Cancelled", className: "bg-slate-100 text-slate-500" },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatRateType(rateType: JobWorkspace["rate_type"]) {
  if (rateType === "per_hour") return "/hr";
  if (rateType === "per_day") return "/day";
  return "fixed";
}

function nextAction({
  job,
  application,
  transaction,
}: {
  job: JobWorkspace;
  application: Application | null;
  transaction: Transaction | null;
}) {
  if (job.status === "in_progress") {
    return {
      title: "Ready to submit?",
      description:
        "When the work is complete, submit it for client review. The client will approve before payout release.",
      icon: <CheckCircle2 size={18} />,
      action: <KinglancerCompleteButton jobId={job.id} />,
    };
  }

  if (job.status === "completed") {
    return {
      title: "Waiting for client approval",
      description:
        "You have submitted this job. The client needs to review the work before escrow can be released.",
      icon: <Clock size={18} />,
      action: null,
    };
  }

  if (job.status === "disputed") {
    return {
      title: "Dispute in progress",
      description:
        "This job is being handled through the dispute process. Avoid taking payment or completion actions outside the agreed process.",
      icon: <AlertTriangle size={18} />,
      action: null,
    };
  }

  if (job.status === "approved" || transaction?.status === "released") {
    return {
      title: "Payment released",
      description:
        "The client approved this job and payment has been released.",
      icon: <CheckCircle2 size={18} />,
      action: null,
    };
  }

  if (job.direct_request_status) {
    return {
      title: "Direct request",
      description:
        "Review the request, accept it, decline it, or request changes before the client funds escrow.",
      icon: <Briefcase size={18} />,
      action: null,
    };
  }

  if (application?.status === "pending") {
    return {
      title: "Application under review",
      description:
        "The client has not selected anyone yet. You can review the job details from here.",
      icon: <Clock size={18} />,
      action: null,
    };
  }

  return {
    title: "No action available",
    description: "There is no action for you to take on this job right now.",
    icon: <Briefcase size={18} />,
    action: null,
  };
}

export default async function KinglancerJobWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [profileResult, jobResult, applicationResult, transactionResult] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("jobs")
        .select(
          `
          id, title, description, budget, rate_type, status, deadline, categories,
          client_id, kinglancer_id, invited_kinglancer_id,
          direct_request_status, direct_request_message,
          counter_budget, counter_rate_type, counter_deadline, created_at,
          client:profiles!client_id(full_name, avatar_url)
        `,
        )
        .eq("id", id)
        .single(),
      supabase
        .from("applications")
        .select("id, status, cover_letter, created_at")
        .eq("job_id", id)
        .eq("kinglancer_id", user.id)
        .maybeSingle(),
      supabase
        .from("transactions")
        .select("amount, platform_fee_kinglancer, status")
        .eq("job_id", id)
        .eq("kinglancer_id", user.id)
        .maybeSingle(),
    ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

  const job = (jobResult as unknown as { data: JobWorkspace | null }).data;
  if (!job) notFound();

  const application = (
    applicationResult as unknown as {
      data: Application | null;
    }
  ).data;
  const transaction = (
    transactionResult as unknown as {
      data: Transaction | null;
    }
  ).data;
  const isAssigned = job.kinglancer_id === user.id;
  const isInvited = job.invited_kinglancer_id === user.id;
  const canViewWorkspace = isAssigned || isInvited || !!application;

  if (!canViewWorkspace) redirect(`/jobs/${id}`);

  const openStatus = isInvited
    ? { label: "Direct request", className: "bg-violet-100 text-violet-700" }
    : { label: "Open", className: "bg-green-100 text-green-700" };
  const status = statusConfig[job.status] ?? openStatus;
  const action = nextAction({ job, application, transaction });
  const netHeld =
    transaction && transaction.status === "held"
      ? transaction.amount - transaction.platform_fee_kinglancer
      : null;

  // Review state for approved jobs (double-blind, 7-day window).
  let reviewState: Awaited<ReturnType<typeof getJobReviewState>> | null = null;
  let reviewWindowClosed = false;
  let reviewRemaining: ReturnType<typeof reviewWindowRemaining> = null;
  if (job.status === "approved") {
    const [state, tx] = await Promise.all([
      getJobReviewState(id, user.id),
      getTransactionByJob(id),
    ]);
    reviewState = state;
    reviewWindowClosed = isReviewWindowClosed(tx?.released_at ?? null);
    const closesAt = tx?.released_at
      ? new Date(
          new Date(tx.released_at).getTime() +
            REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
        ).toISOString()
      : null;
    reviewRemaining = reviewWindowRemaining(closesAt);
  }
  const clientFirstName = job.client?.full_name?.split(" ")[0] ?? "the client";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <DashboardBackLink
        source={from}
        fallbackHref="/dashboard/kinglancer/jobs"
        fallbackLabel="Back to Active Jobs"
      />

      <Card className="overflow-hidden">
        <div className="relative bg-[#10234b] px-5 py-7 text-white sm:px-7">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.26),transparent_36%)]" />
          <div className="relative">
            <StatusBadge className="bg-white/10 text-sky-100 ring-1 ring-white/15">
              Kinglancer workspace
            </StatusBadge>
            <h1 className="mt-4 text-3xl font-black tracking-tight">
              {job.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/70">
              This is your private job workspace. Actions here are specific to
              your kinglancer role and are separate from the public job view.
            </p>
          </div>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3 sm:p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Status
            </p>
            <StatusBadge className={`mt-2 ${status.className}`}>
              {status.label}
            </StatusBadge>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Client
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Avatar
                name={job.client?.full_name}
                src={job.client?.avatar_url}
                className="h-8 w-8 rounded-xl"
              />
              <span className="font-bold text-slate-950">
                {job.client?.full_name ?? "Client"}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Budget
            </p>
            <p className="mt-2 text-lg font-black text-slate-950">
              {formatMoney(Number(job.budget))}
              <span className="ml-1 text-sm font-bold text-slate-400">
                {formatRateType(job.rate_type)}
              </span>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className={cardPadding}>
            <h2 className="text-lg font-black text-slate-950">Job brief</h2>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
              {job.description}
            </p>
            {(job.categories ?? []).length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {job.categories.map((category) => (
                  <span
                    key={category}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                  >
                    {category}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {job.direct_request_status && job.status === "open" && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Respond to request
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Agree to the terms, decline the work, or request changes before
                the client funds escrow.
              </p>
              <div className="mt-5">
                <DirectRequestActions
                  jobId={job.id}
                  viewerRole="kinglancer"
                  isOwner={false}
                  isInvitedKinglancer={isInvited}
                  status={job.direct_request_status}
                  message={job.direct_request_message}
                  counterBudget={job.counter_budget}
                  counterRateType={job.counter_rate_type}
                  counterDeadline={job.counter_deadline}
                  invitedKinglancer={null}
                />
              </div>
            </Card>
          )}

          {application && (
            <Card className={cardPadding}>
              <h2 className="text-lg font-black text-slate-950">
                Your application
              </h2>
              <StatusBadge
                className={
                  application.status === "accepted"
                    ? "mt-3 bg-green-100 text-green-700"
                    : application.status === "rejected"
                      ? "mt-3 bg-slate-100 text-slate-500"
                      : "mt-3 bg-amber-100 text-amber-700"
                }
              >
                {application.status === "accepted"
                  ? "Selected"
                  : application.status === "rejected"
                    ? "Not selected"
                    : "Under review"}
              </StatusBadge>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                {application.cover_letter}
              </p>
            </Card>
          )}

          {job.status === "approved" && (
            <Card id="leave-review" className={`${cardPadding} scroll-mt-24`}>
              <h2 className="text-lg font-black text-slate-950">
                Rate {clientFirstName}
              </h2>
              <p className="mb-4 mt-1 text-sm leading-6 text-slate-500">
                Your feedback builds trust across the KingsHire community.
              </p>
              <ReviewPanel
                jobId={id}
                counterpartName={clientFirstName}
                counterpartRole="client"
                myReview={reviewState?.myReview ?? null}
                counterpartReview={reviewState?.counterpartReview ?? null}
                windowClosed={reviewWindowClosed}
                remaining={reviewRemaining}
              />
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          {" "}
          <Card className={cardPadding}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                {action.icon}
              </div>
              <div>
                <h2 className="font-black text-slate-950">{action.title}</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {action.description}
                </p>
              </div>
            </div>
            {action.action && <div className="mt-5">{action.action}</div>}
          </Card>
          <Card className={cardPadding}>
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Job details
            </h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex items-start gap-3">
                <Briefcase size={16} className="mt-0.5 text-slate-400" />
                <span>
                  {formatMoney(Number(job.budget))}{" "}
                  {formatRateType(job.rate_type)}
                </span>
              </div>
              {netHeld !== null && (
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={16} className="mt-0.5 text-green-500" />
                  <span>{formatMoney(netHeld)} currently held for you</span>
                </div>
              )}
              {job.deadline && (
                <div className="flex items-start gap-3">
                  <Calendar size={16} className="mt-0.5 text-slate-400" />
                  <span>
                    Due{" "}
                    {new Date(job.deadline).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
              {(job.categories ?? []).length > 0 && (
                <div className="flex items-start gap-3">
                  <Tag size={16} className="mt-0.5 text-slate-400" />
                  <span>{job.categories.join(", ")}</span>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
