export const adminCategories = ["payments", "disputes", "reviews"] as const;
export type AdminCategory = (typeof adminCategories)[number];
export type AdminTask = {
  id: string;
  entityKey: string;
  category: AdminCategory;
  kind: "action" | "waiting";
  title: string;
  description: string;
  href: string;
  createdAt: string;
  priority: number;
};

/** One immediate decision per entity; payment recovery takes precedence over
 * dispute resolution or payout. Every count is a projection of these items. */
export function deriveAdminActions(tasks: AdminTask[]) {
  const entities = new Map<string, AdminTask>();
  for (const task of tasks) {
    const previous = entities.get(task.entityKey);
    if (!previous || task.priority < previous.priority)
      entities.set(task.entityKey, task);
  }
  const items = [...entities.values()].sort(
    (a, b) =>
      a.priority - b.priority ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  return {
    items,
    actionCount: items.filter((item) => item.kind === "action").length,
    waitingCount: items.filter((item) => item.kind === "waiting").length,
  };
}

export function selectAdminActions(
  items: AdminTask[],
  category?: string,
  kind = "action",
) {
  return items.filter(
    (item) =>
      (kind === "all" || item.kind === kind) &&
      (!category || category === "all" || item.category === category),
  );
}

export function deriveAdminPayoutView(
  row: {
    status: string;
    payment_method: string;
    payout_method: string | null;
    stripe_transfer_id: string | null;
    manual_payout_reference: string | null;
    stripe_refund_id: string | null;
    release_attempt_id: string | null;
  },
  jobStatus: string,
) {
  const eligible =
    row.status === "held" &&
    jobStatus === "approved" &&
    !row.stripe_transfer_id &&
    !row.manual_payout_reference &&
    !row.stripe_refund_id &&
    !row.release_attempt_id;
  return {
    eligible,
    manual:
      eligible &&
      (row.payment_method === "bank_transfer" ||
        row.payout_method === "manual"),
  };
}
