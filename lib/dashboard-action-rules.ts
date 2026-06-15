type JobActionState = {
  status: string;
  invited_kinglancer_id?: string | null;
  direct_request_status?: string | null;
  has_funded_transaction?: boolean;
};

export function isClientReviewWorkAction(job: JobActionState) {
  return job.status === "completed";
}

export function isClientApplicantReviewAction(
  job: JobActionState,
  applicantCount: number,
) {
  return (
    job.status === "open" &&
    !job.invited_kinglancer_id &&
    applicantCount > 0
  );
}

export function isClientDirectRequestAction(job: JobActionState) {
  return (
    job.status === "open" &&
    !job.has_funded_transaction &&
    ["changes_requested", "accepted_pending_payment"].includes(
      job.direct_request_status ?? "",
    )
  );
}

export function isClientDirectRequestWaiting(job: JobActionState) {
  return (
    job.status === "open" &&
    !job.has_funded_transaction &&
    job.direct_request_status === "pending"
  );
}

export function isKinglancerDirectRequestAction(job: JobActionState) {
  return (
    job.status === "open" &&
    !job.has_funded_transaction &&
    job.direct_request_status === "pending"
  );
}

export function isKinglancerDirectRequestWaiting(job: JobActionState) {
  return (
    job.status === "open" &&
    !job.has_funded_transaction &&
    ["changes_requested", "accepted_pending_payment"].includes(
      job.direct_request_status ?? "",
    )
  );
}

export function getClientActionCounts<TJob extends JobActionState>(
  jobs: TJob[],
  getApplicantCount: (job: TJob) => number,
) {
  return jobs.reduce(
    (counts, job) => {
      if (
        isClientReviewWorkAction(job) ||
        isClientApplicantReviewAction(job, getApplicantCount(job)) ||
        isClientDirectRequestAction(job)
      ) {
        counts.actionCount += 1;
      }

      if (isClientDirectRequestWaiting(job)) {
        counts.waitingCount += 1;
      }

      return counts;
    },
    { actionCount: 0, waitingCount: 0 },
  );
}

export function getKinglancerActionCounts<TJob extends JobActionState>(
  jobs: TJob[],
) {
  return jobs.reduce(
    (counts, job) => {
      if (isKinglancerDirectRequestAction(job)) {
        counts.actionCount += 1;
      }

      if (isKinglancerDirectRequestWaiting(job)) {
        counts.waitingCount += 1;
      }

      return counts;
    },
    { actionCount: 0, waitingCount: 0 },
  );
}
