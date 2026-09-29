import { reviewWindowRemaining, type PendingReviewJob } from "@/lib/db/reviews";
import {
  type KinglancerAgreement,
  type OrgPendingApplication,
} from "@/lib/db/placements";
import { type OrgHeldPlacementPayment } from "@/lib/db/placement-payments";
import {
  type KinglancerRoleOffer,
  type OrgPendingRoleOffer,
} from "@/lib/db/engagements";
import { formatMoney } from "@/lib/utils";
import { jobPriceLabel } from "@/lib/jobs";
import {
  isClientApplicantReviewAction,
  isClientDirectRequestAction,
  isClientDirectRequestWaiting,
  isClientReviewWorkAction,
  isKinglancerDirectRequestAction,
  isKinglancerDirectRequestWaiting,
} from "@/lib/dashboard-action-rules";
import type {
  ActionCentreItem,
  ActionCentreRole,
  ClientActionJob,
  KinglancerActionJob,
} from "./types";

function jobMeta(job: {
  budget: number;
  rate_type: string;
  posting_type: string;
  pay_negotiable: boolean | null;
  pay_amount: number | null;
  pay_cadence: string | null;
}) {
  return jobPriceLabel(job);
}

// ── Pure mappers (row → item). Unit-tested; hold no data access. ─

export function buildClientJobItems(
  jobs: ClientActionJob[],
  applicantCountByJob: Record<string, number>,
  organisationId?: string,
): ActionCentreItem[] {
  // Org-owned jobs live in the org workspace, not the personal jobs route.
  const basePath = organisationId
    ? `/dashboard/organisations/${organisationId}/jobs`
    : "/dashboard/client/jobs";
  const actions: ActionCentreItem[] = [];

  for (const job of jobs) {
    const meta = jobMeta(job);

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
        href: `${basePath}/${job.id}`,
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
        href: `${basePath}/${job.id}`,
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
        href: `${basePath}/${job.id}`,
        icon: "review-work",
        badge: "Review work",
        tone: "amber",
        meta,
      });
    }

    const applicantCount = applicantCountByJob[job.id] ?? 0;
    // A payment in progress locks selection — nothing for the client to do.
    if (
      isClientApplicantReviewAction(job, applicantCount) &&
      !job.has_pending_payment
    ) {
      actions.push({
        id: `${job.id}:applicants`,
        kind: "action",
        title: job.title,
        description: `${applicantCount} applicant${
          applicantCount !== 1 ? "s" : ""
        } waiting for your decision.`,
        href: `${basePath}/${job.id}`,
        icon: "applicants",
        badge: "Review applicants",
        tone: "green",
        meta,
      });
    }
  }

  actions.sort((a, b) => a.title.localeCompare(b.title));

  const waiting: ActionCentreItem[] = [
    ...jobs
      .filter((job) => isClientDirectRequestWaiting(job))
      .map((job) => ({
        id: `${job.id}:waiting-kinglancer`,
        kind: "waiting" as const,
        title: job.title,
        description: `Waiting for ${
          job.invited_kinglancer?.full_name ?? "the Kinglancer"
        } to respond to your direct request.`,
        href: `${basePath}/${job.id}`,
        icon: "request" as const,
        badge: "Waiting",
        tone: "slate" as const,
        meta: jobMeta(job),
      })),
    ...jobs
      .filter((job) => job.status === "open" && job.has_pending_payment)
      .map((job) => ({
        id: `${job.id}:awaiting-payment-confirm`,
        kind: "waiting" as const,
        title: job.title,
        description:
          "Payment in progress — we'll confirm it and start the job shortly.",
        href: `${basePath}/${job.id}`,
        icon: "payment" as const,
        badge: "Payment in progress",
        tone: "slate" as const,
        meta: jobMeta(job),
      })),
  ];

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
      meta: jobMeta(job),
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
        meta: jobMeta(job),
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

export function buildKinglancerRoleOfferItems(
  offers: KinglancerRoleOffer[],
): ActionCentreItem[] {
  const items: ActionCentreItem[] = [];
  for (const offer of offers) {
    const href = `/dashboard/kinglancer/jobs/${offer.jobId}`;
    const meta =
      offer.amountPerPeriod != null
        ? `£${offer.amountPerPeriod.toFixed(2)} ${offer.cadence}`
        : undefined;

    if (offer.status === "pending_acceptance") {
      items.push({
        id: `${offer.engagementId}:role-offer`,
        kind: "action",
        title: offer.jobTitle,
        description: `${
          offer.organisationName ?? "An organisation"
        } offered you this role. Review the terms and accept or decline.`,
        href,
        icon: "request",
        badge: "Reply needed",
        tone: "purple",
        meta,
      });
    } else if (offer.status === "pending_funding") {
      items.push({
        id: `${offer.engagementId}:role-funding`,
        kind: "waiting",
        title: offer.jobTitle,
        description:
          "You've accepted. Waiting for the organisation to fund the first payment period before it starts.",
        href,
        icon: "payment",
        badge: "Awaiting funding",
        tone: "slate",
        meta,
      });
    }
  }
  return items;
}

export function buildOrgRoleOfferItems(
  offers: OrgPendingRoleOffer[],
  organisationId: string,
): ActionCentreItem[] {
  return offers.map((offer) => ({
    id: `${offer.engagementId}:role-offer-waiting`,
    kind: "waiting",
    title: offer.jobTitle,
    description: `Waiting for ${
      offer.kinglancerName ?? "the Kinglancer"
    } to respond to this role offer.`,
    href: `/dashboard/organisations/${organisationId}/jobs/${offer.jobId}/offer`,
    icon: "request",
    badge: "Waiting",
    tone: "slate",
  }));
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

export function dedupeById(items: ActionCentreItem[]): ActionCentreItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
