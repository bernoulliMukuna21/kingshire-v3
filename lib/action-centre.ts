import type { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getPendingReviewJobs,
  reviewWindowRemaining,
  type PendingReviewJob,
} from "@/lib/db/reviews";
import {
  listKinglancerAgreements,
  listPendingPlacementApplicationsForOrg,
  type KinglancerAgreement,
  type OrgPendingApplication,
} from "@/lib/db/placements";
import {
  listHeldPlacementPaymentsForOrg,
  type OrgHeldPlacementPayment,
} from "@/lib/db/placement-payments";
import { formatMoney, formatRateType } from "@/lib/utils";
import {
  isClientApplicantReviewAction,
  isClientDirectRequestAction,
  isClientDirectRequestWaiting,
  isClientReviewWorkAction,
  isKinglancerDirectRequestAction,
  isKinglancerDirectRequestWaiting,
} from "@/lib/dashboard-action-rules";

/**
 * Single source of truth for "what needs my attention".
 *
 * Every surface — the Action Centre page AND the dashboard summary cards —
 * derives from `getActionCentre`. The counts are the length of the same list
 * the page renders, so they can never drift. To add a new kind of action,
 * add or extend a provider below; the list, the counts, and every surface
 * update together.
 */

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type ActionCentreRole = "client" | "kinglancer";
export type ActionKind = "action" | "waiting";
export type ActionTone =
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "slate"
  | "purple";
export type ActionIcon =
  | "review"
  | "review-work"
  | "applicants"
  | "request"
  | "payment"
  | "placement"
  | "alert";

export type ActionCentreItem = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  /** Canonical destination — surfaces append their own `?from` source. */
  href: string;
  icon: ActionIcon;
  badge: string;
  tone: ActionTone;
  meta?: string;
  /** Organisation name, when the action belongs to a workspace (not personal). */
  context?: string;
};

export type ActionCentre = {
  items: ActionCentreItem[];
  actionCount: number;
  waitingCount: number;
};

export type ActionContext = {
  supabase: ServerClient;
  userId: string;
  role: ActionCentreRole;
};

type ActionProvider = (ctx: ActionContext) => Promise<ActionCentreItem[]>;

export type ClientActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  invited_kinglancer_id: string | null;
  direct_request_status: string | null;
  has_funded_transaction?: boolean;
  counter_budget: number | null;
  counter_rate_type: string | null;
  counter_deadline: string | null;
  kinglancer: { full_name: string | null } | null;
  invited_kinglancer: { full_name: string | null } | null;
};

export type KinglancerActionJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  rate_type: string;
  direct_request_status: string | null;
  has_funded_transaction?: boolean;
  client: { full_name: string | null } | null;
};

function jobMeta(budget: number, rateType: string) {
  return `${formatMoney(Number(budget))} ${formatRateType(rateType)}`;
}

// ── Pure mappers (row → item). Unit-tested; hold no data access. ─

export function buildClientJobItems(
  jobs: ClientActionJob[],
  applicantCountByJob: Record<string, number>,
): ActionCentreItem[] {
  const actions: ActionCentreItem[] = [];

  for (const job of jobs) {
    const meta = jobMeta(job.budget, job.rate_type);

    if (
      isClientDirectRequestAction(job) &&
      job.direct_request_status === "changes_requested"
    ) {
      actions.push({
        id: `${job.id}:changes-requested`,
        kind: "action",
        title: job.title,
        description: `${
          job.invited_kinglancer?.full_name ?? "The Kinglancer"
        } requested changes. Review the proposed terms before funding escrow.`,
        href: `/dashboard/client/jobs/${job.id}`,
        icon: "request",
        badge: "Review changes",
        tone: "purple",
        meta,
      });
    }

    if (
      isClientDirectRequestAction(job) &&
      job.direct_request_status === "accepted_pending_payment"
    ) {
      actions.push({
        id: `${job.id}:payment-required`,
        kind: "action",
        title: job.title,
        description: `${
          job.invited_kinglancer?.full_name ?? "The Kinglancer"
        } accepted your request. Fund escrow to start the job.`,
        href: `/dashboard/client/jobs/${job.id}`,
        icon: "payment",
        badge: "Payment required",
        tone: "blue",
        meta,
      });
    }

    if (isClientReviewWorkAction(job)) {
      actions.push({
        id: `${job.id}:review-work`,
        kind: "action",
        title: job.title,
        description: `${
          job.kinglancer?.full_name ?? "Your Kinglancer"
        } submitted this work. Approve it to release payment.`,
        href: `/dashboard/client/jobs/${job.id}`,
        icon: "review-work",
        badge: "Review work",
        tone: "amber",
        meta,
      });
    }

    const applicantCount = applicantCountByJob[job.id] ?? 0;
    if (isClientApplicantReviewAction(job, applicantCount)) {
      actions.push({
        id: `${job.id}:applicants`,
        kind: "action",
        title: job.title,
        description: `${applicantCount} applicant${
          applicantCount !== 1 ? "s" : ""
        } waiting for your decision.`,
        href: `/dashboard/client/jobs/${job.id}`,
        icon: "applicants",
        badge: "Review applicants",
        tone: "green",
        meta,
      });
    }
  }

  actions.sort((a, b) => a.title.localeCompare(b.title));

  const waiting: ActionCentreItem[] = jobs
    .filter((job) => isClientDirectRequestWaiting(job))
    .map((job) => ({
      id: `${job.id}:waiting-kinglancer`,
      kind: "waiting",
      title: job.title,
      description: `Waiting for ${
        job.invited_kinglancer?.full_name ?? "the Kinglancer"
      } to respond to your direct request.`,
      href: `/dashboard/client/jobs/${job.id}`,
      icon: "request",
      badge: "Waiting",
      tone: "slate",
      meta: jobMeta(job.budget, job.rate_type),
    }));

  return dedupeById([...actions, ...waiting]);
}

export function buildKinglancerJobItems(
  jobs: KinglancerActionJob[],
): ActionCentreItem[] {
  const actions: ActionCentreItem[] = jobs
    .filter((job) => isKinglancerDirectRequestAction(job))
    .map((job) => ({
      id: `${job.id}:respond`,
      kind: "action",
      title: job.title,
      description: `${
        job.client?.full_name ?? "A client"
      } sent you a direct request. Accept, decline, or request changes.`,
      href: `/dashboard/kinglancer/jobs/${job.id}`,
      icon: "request",
      badge: "Reply needed",
      tone: "purple",
      meta: jobMeta(job.budget, job.rate_type),
    }));

  const waiting: ActionCentreItem[] = jobs
    .filter((job) => isKinglancerDirectRequestWaiting(job))
    .map((job) => {
      const changesRequested =
        job.direct_request_status === "changes_requested";
      return {
        id: `${job.id}:waiting`,
        kind: "waiting",
        title: job.title,
        description: changesRequested
          ? "Waiting for the client to review your requested changes."
          : "You accepted this request. Waiting for the client to fund escrow.",
        href: `/dashboard/kinglancer/jobs/${job.id}`,
        icon: changesRequested ? "alert" : "payment",
        badge: changesRequested ? "Waiting on client" : "Awaiting payment",
        tone: "slate",
        meta: jobMeta(job.budget, job.rate_type),
      };
    });

  return [...actions, ...waiting];
}

export function buildReviewItems(
  pending: PendingReviewJob[],
  role: ActionCentreRole,
): ActionCentreItem[] {
  return pending.map((job) => {
    const name =
      job.counterpartName ??
      (role === "client" ? "your Kinglancer" : "the client");
    const remaining = reviewWindowRemaining(job.closesAt);
    return {
      id: `${job.jobId}:leave-review`,
      kind: "action",
      title: job.jobTitle,
      description: `This job is complete. Share your honest feedback on working with ${name}.`,
      href: `/dashboard/${role}/jobs/${job.jobId}#leave-review`,
      icon: "review",
      badge: remaining?.urgent ? "Closes soon" : "Leave a review",
      tone: remaining?.urgent ? "red" : "amber",
      meta: remaining?.label,
    };
  });
}

export function buildPlacementItems(
  agreements: KinglancerAgreement[],
): ActionCentreItem[] {
  const items: ActionCentreItem[] = [];
  for (const agreement of agreements) {
    const title = agreement.placement?.title ?? "Placement";
    const href = `/dashboard/placements/agreements/${agreement.id}`;

    if (
      agreement.status === "pending_acceptance" &&
      agreement.placement?.status !== "cancelled"
    ) {
      items.push({
        id: `${agreement.id}:placement-offer`,
        kind: "action",
        title,
        description:
          "You've been offered this placement. Accept or decline to continue.",
        href,
        icon: "placement",
        badge: "Placement offer",
        tone: "purple",
      });
    } else if (agreement.status === "pending_funding") {
      items.push({
        id: `${agreement.id}:placement-funding`,
        kind: "waiting",
        title,
        description:
          "You've accepted. Waiting for the organisation to fund the first month before it starts.",
        href,
        icon: "payment",
        badge: "Awaiting funding",
        tone: "slate",
      });
    }
  }
  return items;
}

export function buildOrgPlacementPaymentItems(
  payments: OrgHeldPlacementPayment[],
): ActionCentreItem[] {
  return payments.map((payment) => ({
    id: `${payment.id}:placement-payment-review`,
    kind: "action",
    title: payment.agreement?.placement?.title ?? "Placement",
    description: `${
      payment.kinglancer?.full_name ?? "The participant"
    }'s payment for this month is in escrow. Approve to release it, or raise a dispute.`,
    href: `/dashboard/placements/agreements/${payment.agreement_id}`,
    icon: "payment",
    badge: "Review payment",
    tone: "amber",
    meta: formatMoney(Number(payment.amount)),
  }));
}

export function buildOrgApplicationItems(
  applications: OrgPendingApplication[],
  organisationId: string,
): ActionCentreItem[] {
  const byPlacement = new Map<string, { title: string; count: number }>();
  for (const application of applications) {
    const current = byPlacement.get(application.placementId);
    if (current) current.count += 1;
    else
      byPlacement.set(application.placementId, {
        title: application.placementTitle,
        count: 1,
      });
  }
  return Array.from(byPlacement.entries()).map(([placementId, entry]) => ({
    id: `${placementId}:placement-applicants`,
    kind: "action",
    title: entry.title,
    description: `${entry.count} applicant${
      entry.count !== 1 ? "s" : ""
    } waiting for your decision.`,
    href: `/dashboard/organisations/${organisationId}/placements/${placementId}`,
    icon: "applicants",
    badge: "Review applicants",
    tone: "green",
  }));
}

function dedupeById(items: ActionCentreItem[]): ActionCentreItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

// ── Data access + providers ─

async function getFundedJobIds(
  supabase: ServerClient,
  jobIds: string[],
): Promise<Set<string>> {
  if (jobIds.length === 0) return new Set<string>();
  const { data } = await supabase
    .from("transactions")
    .select("job_id")
    .in("job_id", jobIds)
    .in("status", ["held", "released", "disputed"]);
  return new Set((data ?? []).map((transaction) => transaction.job_id));
}

const clientJobsProvider: ActionProvider = ({ supabase, userId }) =>
  fetchClientStyleJobItems(supabase, "client_id", userId);

// Client and organisation job actions share the same shape; only the scoping
// column differs (personal jobs by client_id, org jobs by organisation_id).
async function fetchClientStyleJobItems(
  supabase: ServerClient,
  column: "client_id" | "organisation_id",
  value: string,
): Promise<ActionCentreItem[]> {
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
    .eq(column, value)
    .or(
      "status.eq.completed,status.eq.open,direct_request_status.eq.changes_requested,direct_request_status.eq.accepted_pending_payment,direct_request_status.eq.pending",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  const jobs = (jobsRaw ?? []) as unknown as ClientActionJob[];
  const jobIds = jobs.map((job) => job.id);

  const [applicationsResult, fundedJobIds] = await Promise.all([
    jobIds.length
      ? supabase
          .from("applications")
          .select("job_id")
          .in("job_id", jobIds)
          .eq("status", "pending")
      : Promise.resolve({ data: [] }),
    getFundedJobIds(supabase, jobIds),
  ]);

  const applicantCountByJob = (applicationsResult.data ?? []).reduce<
    Record<string, number>
  >((acc, row) => {
    acc[row.job_id] = (acc[row.job_id] ?? 0) + 1;
    return acc;
  }, {});

  const jobsWithFunding = jobs.map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
  }));

  return buildClientJobItems(jobsWithFunding, applicantCountByJob);
}

const kinglancerJobsProvider: ActionProvider = async ({ supabase, userId }) => {
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
  const fundedJobIds = await getFundedJobIds(
    supabase,
    jobs.map((job) => job.id),
  );
  const jobsWithFunding = jobs.map((job) => ({
    ...job,
    has_funded_transaction: fundedJobIds.has(job.id),
  }));

  return buildKinglancerJobItems(jobsWithFunding);
};

const reviewsProvider: ActionProvider = async ({ userId, role }) => {
  const pending = await getPendingReviewJobs(userId, role);
  return buildReviewItems(pending, role);
};

const placementsProvider: ActionProvider = async ({ userId }) => {
  const agreements = await listKinglancerAgreements(userId);
  return buildPlacementItems(agreements);
};

const PROVIDERS: Record<ActionCentreRole, ActionProvider[]> = {
  client: [clientJobsProvider, reviewsProvider],
  kinglancer: [kinglancerJobsProvider, reviewsProvider, placementsProvider],
};

export type AccountOrganisation = { id: string; name: string };

/**
 * The single, account-level Action Centre for the logged-in user: their own
 * role actions PLUS the actions for every organisation they belong to, each
 * tagged with its workspace name. This is what the sidebar + dashboard land on.
 */
export async function getAccountActionCentre(ctx: {
  supabase: ServerClient;
  userId: string;
  role: ActionCentreRole;
  organisations: AccountOrganisation[];
}): Promise<ActionCentre> {
  const [personalResults, orgResults] = await Promise.all([
    Promise.all(
      PROVIDERS[ctx.role].map((provider) =>
        provider({
          supabase: ctx.supabase,
          userId: ctx.userId,
          role: ctx.role,
        }),
      ),
    ),
    Promise.all(
      ctx.organisations.map(async (org) => {
        const items = await collectOrgActionItems(org.id);
        return items.map((item) => ({ ...item, context: org.name }));
      }),
    ),
  ]);
  const items = dedupeById([...personalResults.flat(), ...orgResults.flat()]);
  return {
    items,
    actionCount: items.filter((item) => item.kind === "action").length,
    waitingCount: items.filter((item) => item.kind === "waiting").length,
  };
}

// ── Organisation actions (folded into the account Action Centre) ─
// Org-wide reads use the service client (bypasses RLS); membership is verified
// by the caller — the dashboard context only lists the user's own workspaces.

async function orgJobItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  return fetchClientStyleJobItems(
    createServiceClient() as unknown as ServerClient,
    "organisation_id",
    organisationId,
  );
}

async function orgPaymentItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const payments = await listHeldPlacementPaymentsForOrg(organisationId);
  return buildOrgPlacementPaymentItems(payments);
}

async function orgApplicationItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const applications =
    await listPendingPlacementApplicationsForOrg(organisationId);
  return buildOrgApplicationItems(applications, organisationId);
}

const ORGANISATION_PROVIDERS = [
  orgJobItems,
  orgPaymentItems,
  orgApplicationItems,
];

async function collectOrgActionItems(
  organisationId: string,
): Promise<ActionCentreItem[]> {
  const results = await Promise.all(
    ORGANISATION_PROVIDERS.map((provider) => provider(organisationId)),
  );
  return results.flat();
}
