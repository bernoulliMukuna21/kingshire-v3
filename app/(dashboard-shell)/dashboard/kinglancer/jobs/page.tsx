import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  Briefcase,
  Calendar,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Card, cardPadding } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type ActiveJob = {
  id: string;
  title: string;
  budget: number;
  rate_type: "fixed" | "per_hour" | "per_day";
  status: "in_progress" | "completed" | "disputed" | "approved";
  deadline: string | null;
  updated_at: string;
  client: { full_name: string | null } | null;
};

type Transaction = {
  job_id: string;
  amount: number;
  platform_fee_kinglancer: number;
  status: string;
};

const jobStatus: Record<
  ActiveJob["status"],
  { label: string; className: string; description: string }
> = {
  in_progress: {
    label: "In progress",
    className: "bg-blue-100 text-blue-700",
    description: "Deliver the work, then submit it for client review.",
  },
  completed: {
    label: "Awaiting approval",
    className: "bg-amber-100 text-amber-700",
    description: "You submitted this work. The client needs to approve it.",
  },
  disputed: {
    label: "Disputed",
    className: "bg-red-100 text-red-700",
    description: "This job is being handled through the dispute process.",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700",
    description: "This job has been approved.",
  },
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatRateType(rateType: ActiveJob["rate_type"]) {
  if (rateType === "per_hour") return "/hr";
  if (rateType === "per_day") return "/day";
  return "fixed";
}

export default async function KinglancerActiveJobsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ data: profile }, activeJobsResult, transactionsResult] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("jobs")
        .select(
          "id, title, budget, rate_type, status, deadline, updated_at, client:profiles!client_id(full_name)",
        )
        .eq("kinglancer_id", user.id)
        .in("status", ["in_progress", "completed", "disputed"])
        .order("updated_at", { ascending: false }),
      supabase
        .from("transactions")
        .select("job_id, amount, platform_fee_kinglancer, status")
        .eq("kinglancer_id", user.id)
        .in("status", ["held", "disputed", "released"]),
    ]);

  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

  const jobs = (activeJobsResult.data ?? []) as ActiveJob[];
  const transactions = (transactionsResult.data ?? []) as Transaction[];
  const transactionByJob = new Map(
    transactions.map((transaction) => [transaction.job_id, transaction]),
  );

  const totalHeld = jobs.reduce((sum, job) => {
    const transaction = transactionByJob.get(job.id);
    if (!transaction || transaction.status !== "held") return sum;
    return sum + transaction.amount - transaction.platform_fee_kinglancer;
  }, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="Kinglancer work"
        title="Active Jobs"
        description="Track the jobs you have been selected for, submit completed work, and monitor approval status."
        action={
          <ButtonLink href="/jobs" variant="secondary">
            Browse jobs
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Active
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {
              jobs.filter((job) =>
                ["in_progress", "completed", "disputed"].includes(job.status),
              ).length
            }
          </p>
        </Card>
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Submitted
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {jobs.filter((job) => job.status === "completed").length}
          </p>
        </Card>
        <Card className={cardPadding}>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Held in escrow
          </p>
          <p className="mt-2 text-3xl font-black text-slate-950">
            {formatMoney(totalHeld)}
          </p>
        </Card>
      </div>

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={22} />}
          title="No active jobs yet"
          description="When a client selects you and funds escrow, your active jobs will appear here."
          action={<ButtonLink href="/jobs">Browse open jobs</ButtonLink>}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const status = jobStatus[job.status];
            const transaction = transactionByJob.get(job.id);
            const heldAmount =
              transaction && transaction.status === "held"
                ? transaction.amount - transaction.platform_fee_kinglancer
                : null;

            return (
              <Link
                key={job.id}
                href={`/dashboard/kinglancer/jobs/${job.id}`}
                className="group block"
              >
                <Card
                  interactive
                  className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-black text-slate-950 transition-colors group-hover:text-blue-700">
                        {job.title}
                      </h2>
                      <StatusBadge className={status.className}>
                        {status.label}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {status.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase size={14} />
                        {job.client?.full_name ?? "Client"}
                      </span>
                      {job.deadline && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={14} />
                          Due{" "}
                          {new Date(job.deadline).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                      {job.status === "disputed" && (
                        <span className="inline-flex items-center gap-1.5 text-red-600">
                          <AlertTriangle size={14} />
                          Dispute active
                        </span>
                      )}
                      {job.status === "completed" && (
                        <span className="inline-flex items-center gap-1.5 text-amber-600">
                          <CheckCircle2 size={14} />
                          Submitted
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <div className="text-left sm:text-right">
                      <p className="text-lg font-black text-slate-950">
                        {formatMoney(Number(job.budget))}
                        <span className="ml-1 text-sm font-bold text-slate-400">
                          {formatRateType(job.rate_type)}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        {heldAmount !== null
                          ? `${formatMoney(heldAmount)} held`
                          : "Escrow status unavailable"}
                      </p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="text-slate-300 transition-colors group-hover:text-blue-500"
                    />
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
