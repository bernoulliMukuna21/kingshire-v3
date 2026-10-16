import { getAdminDb } from "./access";
import { deriveAdminHistoryItem } from "./payment-history-view";
function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
export async function getAdminPaymentHistory(
  ledger: "transactions" | "engagement_payments",
  from: number,
  to: number,
) {
  const db = await getAdminDb();
  if (ledger === "transactions") {
    const result = await db
      .from("transactions")
      .select(
        "id,status,created_at,amount,platform_fee_kinglancer,payment_method,payout_method,stripe_transfer_id,manual_payout_reference,job:jobs!job_id(title),worker:profiles!kinglancer_id(full_name)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    if (result.error) throw result.error;
    return {
      total: result.count ?? 0,
      items: result.data.map((row) =>
        deriveAdminHistoryItem({
          id: row.id,
          status: row.status,
          created_at: row.created_at,
          gross: row.amount,
          workerFee: row.platform_fee_kinglancer,
          title: one(row.job)?.title ?? null,
          workerName: one(row.worker)?.full_name ?? null,
          fundingMethod: row.payment_method,
          payoutMethod: row.payout_method,
          stripeTransferId: row.stripe_transfer_id,
          manualPayoutReference: row.manual_payout_reference,
          ledger,
        }),
      ),
    };
  }
  const result = await db
    .from("engagement_payments")
    .select(
      "id,status,created_at,worker_amount,platform_fee_kinglancer,period_index,engagement_id,stripe_transfer_id,worker:profiles!kinglancer_id(full_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id")
    .range(from, to);
  if (result.error) throw result.error;
  if (!result.data.length) return { total: result.count ?? 0, items: [] };
  const engagements = await db
    .from("engagements")
    .select("id,source_kind,source_id")
    .in("id", [...new Set(result.data.map((row) => row.engagement_id))]);
  if (engagements.error) throw engagements.error;
  const roles = engagements.data
    .filter((row) => row.source_kind === "org_role")
    .map((row) => row.source_id);
  const placements = engagements.data
    .filter((row) => row.source_kind === "placement")
    .map((row) => row.source_id);
  const [jobs, agreements] = await Promise.all([
    roles.length
      ? db.from("jobs").select("id,title").in("id", roles)
      : Promise.resolve({ data: [], error: null }),
    placements.length
      ? db
          .from("placement_agreements")
          .select("id,placement:placements!placement_id(title)")
          .in("id", placements)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (jobs.error) throw jobs.error;
  if (agreements.error) throw agreements.error;
  const titles = new Map([
    ...jobs.data.map((row) => [row.id, row.title] as const),
    ...agreements.data.map(
      (row) =>
        [row.id, one(row.placement)?.title ?? "Placement payment"] as const,
    ),
  ]);
  const contexts = new Map(engagements.data.map((row) => [row.id, row]));
  return {
    total: result.count ?? 0,
    items: result.data.map((row) =>
      deriveAdminHistoryItem({
        id: row.id,
        status: row.status,
        created_at: row.created_at,
        gross: row.worker_amount,
        workerFee: row.platform_fee_kinglancer,
        title:
          titles.get(contexts.get(row.engagement_id)?.source_id ?? "") ?? null,
        workerName: one(row.worker)?.full_name ?? null,
        fundingMethod: "card",
        payoutMethod: row.stripe_transfer_id ? "stripe" : null,
        periodIndex: row.period_index,
        ledger,
      }),
    ),
  };
}
