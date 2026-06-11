import { redirect } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Send,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import {
  ActionCentreHeader,
  ActionItemCard,
  ActionSection,
  ActionSummary,
  WaitingItemCard,
  type ActionItem,
} from "@/components/dashboard/ActionCentre";

type Profile = {
  role: "client" | "kinglancer" | "admin" | null;
};

type ClientActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
  counter_budget: number | null;
  counter_rate_type: string | null;
  counter_deadline: string | null;
  kinglancer: { full_name: string | null } | null;
  invited_kinglancer: { full_name: string | null } | null;
};

type KinglancerActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  direct_request_status: string | null;
  client: { full_name: string | null } | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatRateType(rateType: string | null) {
  if (rateType === "per_hour") return "per hour";
  if (rateType === "per_day") return "per day";
  return "fixed";
}

function uniqueActions(actions: ActionItem[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    if (seen.has(action.id)) return false;
    seen.add(action.id);
    return true;
  });
}

async function getClientActionData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: jobsRaw } = await supabase
    .from("jobs")
    .select(
      `
      id, title, status, budget, rate_type,
      invited_kinglancer_id, direct_request_status,
      counter_budget, counter_rate_type, counter_deadline,
      kinglancer:profiles!kinglancer_id(full_name),
      invited_kinglancer:profiles!invited_kinglancer_id(full_name)
    `,
    )
    .eq("client_id", userId)
    .or(
      "status.eq.completed,status.eq.open,direct_request_status.eq.changes_requested,direct_request_status.eq.accepted_pending_payment,direct_request_status.eq.pending",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (jobsRaw ?? []) as unknown as ClientActionJob[];
  const jobIds = jobs.map((job) => job.id);
  const { data: applicationsRaw } = jobIds.length
    ? await supabase
        .from("applications")
        .select("job_id")
        .in("job_id", jobIds)
        .eq("status", "pending")
    : { data: [] };

  const applicationCountByJob = (applicationsRaw ?? []).reduce<
    Record<string, number>
  >((acc, row) => {
    acc[row.job_id] = (acc[row.job_id] ?? 0) + 1;
    return acc;
  }, {});

  const actionItems = uniqueActions(
    jobs
      .flatMap<ActionItem>((job) => {
        const items: ActionItem[] = [];
        const budget = `${formatMoney(Number(job.budget))} ${formatRateType(job.rate_type)}`;

        if (job.direct_request_status === "changes_requested") {
          items.push({
            id: `${job.id}:changes-requested`,
            title: job.title,
            description: `${
              job.invited_kinglancer?.full_name ?? "The Kinglancer"
            } requested changes. Review the proposed terms before funding escrow.`,
            href: `/dashboard/client/jobs/${job.id}`,
            icon: <Send size={18} />,
            badge: "Review changes",
            tone: "purple",
            meta: budget,
          });
        }

        if (job.direct_request_status === "accepted_pending_payment") {
          items.push({
            id: `${job.id}:payment-required`,
            title: job.title,
            description: `${
              job.invited_kinglancer?.full_name ?? "The Kinglancer"
            } accepted your request. Fund escrow to start the job.`,
            href: `/dashboard/client/jobs/${job.id}`,
            icon: <CreditCard size={18} />,
            badge: "Payment required",
            tone: "blue",
            meta: budget,
          });
        }

        if (job.status === "completed") {
          items.push({
            id: `${job.id}:review-work`,
            title: job.title,
            description: `${
              job.kinglancer?.full_name ?? "Your Kinglancer"
            } submitted this work. Approve it to release payment.`,
            href: `/dashboard/client/jobs/${job.id}`,
            icon: <CheckCircle2 size={18} />,
            badge: "Review work",
            tone: "amber",
            meta: budget,
          });
        }

        const applicantCount = applicationCountByJob[job.id] ?? 0;
        if (
          job.status === "open" &&
          !job.invited_kinglancer_id &&
          applicantCount > 0
        ) {
          items.push({
            id: `${job.id}:applicants`,
            title: job.title,
            description: `${applicantCount} applicant${
              applicantCount !== 1 ? "s" : ""
            } waiting for your decision.`,
            href: `/dashboard/client/jobs/${job.id}`,
            icon: <Users size={18} />,
            badge: "Review applicants",
            tone: "green",
            meta: budget,
          });
        }

        return items;
      })
      .sort((a, b) => a.title.localeCompare(b.title)),
  );

  const waitingItems = jobs
    .filter((job) => job.direct_request_status === "pending")
    .map<ActionItem>((job) => ({
      id: `${job.id}:waiting-kinglancer`,
      title: job.title,
      description: `Waiting for ${
        job.invited_kinglancer?.full_name ?? "the Kinglancer"
      } to respond to your direct request.`,
      href: `/dashboard/client/jobs/${job.id}`,
      icon: <Send size={18} />,
      badge: "Waiting",
      tone: "slate",
      meta: `${formatMoney(Number(job.budget))} ${formatRateType(job.rate_type)}`,
    }));

  return { actionItems, waitingItems };
}

async function getKinglancerActionData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const { data: jobsRaw } = await supabase
    .from("jobs")
    .select(
      "id, title, status, budget, rate_type, direct_request_status, client:profiles!client_id(full_name)",
    )
    .eq("invited_kinglancer_id", userId)
    .in("direct_request_status", [
      "pending",
      "changes_requested",
      "accepted_pending_payment",
    ])
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (jobsRaw ?? []) as unknown as KinglancerActionJob[];

  const actionItems = jobs
    .filter((job) => job.direct_request_status === "pending")
    .map<ActionItem>((job) => ({
      id: `${job.id}:respond`,
      title: job.title,
      description: `${
        job.client?.full_name ?? "A client"
      } sent you a direct request. Accept, decline, or request changes.`,
      href: `/dashboard/kinglancer/jobs/${job.id}`,
      icon: <Send size={18} />,
      badge: "Reply needed",
      tone: "purple",
      meta: `${formatMoney(Number(job.budget))} ${formatRateType(job.rate_type)}`,
    }));

  const waitingItems = jobs
    .filter((job) =>
      ["changes_requested", "accepted_pending_payment"].includes(
        job.direct_request_status ?? "",
      ),
    )
    .map<ActionItem>((job) => ({
      id: `${job.id}:waiting`,
      title: job.title,
      description:
        job.direct_request_status === "changes_requested"
          ? "Waiting for the client to review your requested changes."
          : "You accepted this request. Waiting for the client to fund escrow.",
      href: `/dashboard/kinglancer/jobs/${job.id}`,
      icon:
        job.direct_request_status === "changes_requested" ? (
          <AlertCircle size={18} />
        ) : (
          <CreditCard size={18} />
        ),
      badge:
        job.direct_request_status === "changes_requested"
          ? "Waiting on client"
          : "Awaiting payment",
      tone: "slate",
      meta: `${formatMoney(Number(job.budget))} ${formatRateType(job.rate_type)}`,
    }));

  return { actionItems, waitingItems };
}

export default async function ActionCentrePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()) as { data: Profile | null };

  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (!profile.role) redirect("/onboarding");

  const { actionItems, waitingItems } =
    profile.role === "client"
      ? await getClientActionData(supabase, user.id)
      : await getKinglancerActionData(supabase, user.id);

  const roleLabel = profile.role === "client" ? "Client" : "Kinglancer";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <ActionCentreHeader
        roleLabel={roleLabel}
        actionCount={actionItems.length}
      />
      <ActionSummary
        actionCount={actionItems.length}
        waitingCount={waitingItems.length}
      />

      {actionItems.length === 0 && waitingItems.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="You are all caught up"
          description="When a job needs a reply, decision, approval, or escrow payment, it will appear here."
          action={
            profile.role === "client" ? (
              <ButtonLink href="/jobs/post" size="sm">
                Post a job
              </ButtonLink>
            ) : (
              <ButtonLink href="/jobs" size="sm">
                Browse jobs
              </ButtonLink>
            )
          }
        />
      ) : (
        <div className="space-y-8">
          {actionItems.length > 0 && (
            <ActionSection
              title="Needs action"
              description="These items are waiting for you."
            >
              {actionItems.map((item) => (
                <ActionItemCard key={item.id} item={item} />
              ))}
            </ActionSection>
          )}

          {waitingItems.length > 0 && (
            <ActionSection
              title="Waiting on others"
              description="These are useful to track, but they do not need action from you right now."
            >
              {waitingItems.map((item) => (
                <WaitingItemCard key={item.id} item={item} />
              ))}
            </ActionSection>
          )}
        </div>
      )}
    </div>
  );
}
