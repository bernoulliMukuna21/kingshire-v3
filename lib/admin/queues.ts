import { cache } from "react";
import { collectPages } from "@/lib/db/pagination";
import { getAdminDb } from "./access";
import {
  deriveAdminActions,
  deriveAdminPayoutView,
  type AdminTask,
} from "./action-view";

/** Each provider is complete or explicitly unavailable. React cache shares one
 * request's list across layout badge, overview preview and action-centre page. */
export const getAdminQueues = cache(async () => {
  const db = await getAdminDb();
  const providers = {
    jobs: () =>
      collectPages((from, to) =>
        db
          .from("jobs")
          .select("id,title,status,created_at")
          .order("id")
          .range(from, to),
      ),
    payments: () =>
      collectPages((from, to) =>
        db.from("transactions").select("*").order("id").range(from, to),
      ),
    periods: () =>
      collectPages((from, to) =>
        db.from("engagement_payments").select("*").order("id").range(from, to),
      ),
    engagements: () =>
      collectPages((from, to) =>
        db
          .from("engagements")
          .select("id,source_kind,source_id,status,settlement_hold_at")
          .order("id")
          .range(from, to),
      ),
    disputes: () =>
      collectPages((from, to) =>
        db
          .from("disputes")
          .select("*")
          .eq("status", "open")
          .order("id")
          .range(from, to),
      ),
    receipts: () =>
      collectPages((from, to) =>
        db
          .from("payment_attempts")
          .select("id,job_id,created_at,client_marked_paid_at")
          .eq("status", "pending")
          .eq("method", "bank_transfer")
          .order("id")
          .range(from, to),
      ),
    placements: () =>
      collectPages((from, to) =>
        db
          .from("placements")
          .select("id,title,created_at")
          .eq("status", "pending_review")
          .order("id")
          .range(from, to),
      ),
    experience: () =>
      collectPages((from, to) =>
        db
          .from("experience_records")
          .select("id,title,created_at")
          .eq("verification_status", "pending")
          .order("id")
          .range(from, to),
      ),
  };
  async function read<T>(name: string, provider: () => Promise<T[]>) {
    try {
      return { rows: await provider(), unavailable: null };
    } catch (error) {
      console.error(`[admin queues] ${name}`, error);
      return { rows: [] as T[], unavailable: name };
    }
  }
  const [
    jobs,
    payments,
    periods,
    engagements,
    disputes,
    receipts,
    placements,
    experience,
  ] = await Promise.all([
    read("jobs", providers.jobs),
    read("payments", providers.payments),
    read("periods", providers.periods),
    read("engagements", providers.engagements),
    read("disputes", providers.disputes),
    read("receipts", providers.receipts),
    read("placements", providers.placements),
    read("experience", providers.experience),
  ]);
  const unavailable = [
    jobs,
    payments,
    periods,
    engagements,
    disputes,
    receipts,
    placements,
    experience,
  ].flatMap((result) => (result.unavailable ? [result.unavailable] : []));
  const jobById = new Map(jobs.rows.map((job) => [job.id, job]));
  const engagementById = new Map(engagements.rows.map((row) => [row.id, row]));
  const tasks: AdminTask[] = [];
  const add = (task: AdminTask) => tasks.push(task);
  for (const row of payments.rows) {
    const job = jobById.get(row.job_id);
    const entityKey = `transaction:${row.id}`;
    if (row.release_attempt_id && row.release_outcome !== "succeeded") {
      add({
        id: `recovery:${row.id}`,
        entityKey,
        category: "payments",
        kind: "action",
        priority: 0,
        title: job?.title ?? "Job payment",
        description:
          "Verify the payment outcome before any further settlement.",
        href: `/admin/settlements#${row.id}`,
        createdAt: row.created_at,
      });
    } else if (job) {
      const view = deriveAdminPayoutView(row, job.status);
      if (view.eligible)
        add({
          id: `payout:${row.id}`,
          entityKey,
          category: "payments",
          kind: view.manual ? "action" : "waiting",
          priority: view.manual ? 2 : 6,
          title: job.title,
          description: view.manual
            ? "Approved work awaiting an external worker payout."
            : "Stripe payout awaiting settlement or account readiness.",
          href: view.manual
            ? `/admin/manual-payments#${row.job_id}`
            : "/admin/finance?tab=history",
          createdAt: row.created_at,
        });
    }
  }
  for (const row of disputes.rows) {
    const payment = payments.rows.find(
      (payment) => payment.job_id === row.job_id,
    );
    add({
      id: `dispute:${row.id}`,
      entityKey: payment ? `transaction:${payment.id}` : `job:${row.job_id}`,
      category: "disputes",
      kind: "action",
      priority: 1,
      title: jobById.get(row.job_id)?.title ?? "Job dispute",
      description: row.reason,
      href: `/admin/disputes#${row.id}`,
      createdAt: row.created_at,
    });
  }
  for (const row of periods.rows) {
    const engagement = engagementById.get(row.engagement_id);
    const recovery =
      !!row.release_attempt_id && row.release_outcome !== "succeeded";
    if (!recovery && row.status !== "disputed") continue;
    add({
      id: `period:${row.id}`,
      entityKey: `period:${row.id}`,
      category: recovery ? "payments" : "disputes",
      kind: "action",
      priority: recovery ? 0 : 1,
      title: `${engagement?.source_kind === "org_role" ? "Role" : "Placement"} payment · period ${row.period_index}`,
      description: recovery
        ? "Verify the payment outcome before retrying."
        : (row.dispute_reason ?? "Payment under dispute."),
      href: recovery
        ? `/admin/settlements#${row.id}`
        : `/admin/disputes#${row.id}`,
      createdAt: row.created_at,
    });
  }
  for (const row of engagements.rows.filter(
    (row) => row.status === "active" && row.settlement_hold_at,
  )) {
    if (
      periods.rows.some(
        (payment) =>
          payment.engagement_id === row.id &&
          tasks.some((task) => task.entityKey === `period:${payment.id}`),
      )
    )
      continue;
    add({
      id: `hold:${row.id}`,
      entityKey: `engagement:${row.id}`,
      category: "payments",
      kind: "action",
      priority: 0,
      title: "Engagement settlement hold",
      description: "Review the blocked engagement before resuming payments.",
      href: `/admin/settlements#${row.id}`,
      createdAt: row.settlement_hold_at!,
    });
  }
  for (const row of receipts.rows)
    add({
      id: `receipt:${row.id}`,
      entityKey: `receipt:${row.id}`,
      category: "payments",
      kind: row.client_marked_paid_at ? "action" : "waiting",
      priority: row.client_marked_paid_at ? 2 : 6,
      title: jobById.get(row.job_id)?.title ?? "Bank payment",
      description: row.client_marked_paid_at
        ? "Client says money was sent. Check the bank before confirming receipt."
        : "Waiting for the client to send funds.",
      href: `/admin/manual-payments#${row.id}`,
      createdAt: row.created_at,
    });
  for (const row of placements.rows)
    add({
      id: `placement:${row.id}`,
      entityKey: `placement:${row.id}`,
      category: "reviews",
      kind: "action",
      priority: 3,
      title: row.title,
      description: "Placement awaiting publishing approval.",
      href: `/admin/reviews?tab=placements#${row.id}`,
      createdAt: row.created_at,
    });
  for (const row of experience.rows)
    add({
      id: `experience:${row.id}`,
      entityKey: `experience:${row.id}`,
      category: "reviews",
      kind: "action",
      priority: 3,
      title: row.title,
      description: "Experience record awaiting verification.",
      href: `/admin/reviews?tab=experience#${row.id}`,
      createdAt: row.created_at,
    });
  for (const job of jobs.rows.filter((job) => job.status === "completed")) {
    const payment = payments.rows.find((row) => row.job_id === job.id);
    if (
      !payment ||
      payment.status !== "held" ||
      payment.stripe_transfer_id ||
      payment.manual_payout_reference ||
      tasks.some((task) => task.entityKey === `transaction:${payment.id}`)
    )
      continue;
    add({
      id: `approval:${job.id}`,
      entityKey: `transaction:${payment.id}`,
      category: "payments",
      kind: "waiting",
      priority: 7,
      title: job.title,
      description:
        "Completed work awaiting client approval. No admin approval is required.",
      href: `/jobs/${job.id}`,
      createdAt: job.created_at,
    });
  }
  return {
    ...deriveAdminActions(tasks),
    unavailable,
    payments: payments.rows,
    jobs: jobs.rows,
    disputes: disputes.rows,
    periods: periods.rows,
    engagementById,
    jobById,
  };
});
