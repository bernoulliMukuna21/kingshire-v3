import { requireAdminPage } from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";
import { collectPages } from "@/lib/db/pagination";
import { deriveRecoveryView } from "@/lib/settlement/recovery-view";
import RecoveryActions from "./RecoveryActions";

export default async function SettlementRecoveryPage() {
  await requireAdminPage();
  const db = createServiceClient();
  const ledgers = ["transactions", "engagement_payments"] as const;
  const [groups, holds] = await Promise.all([
    Promise.all(
      ledgers.map(async (ledger) => ({
        ledger,
        rows: await collectPages((from, to) =>
          db
            .from(ledger)
            .select(
              "id, release_attempt_id, release_outcome, release_dispatch_started_at, release_failure_code, release_idempotency_key, stripe_transfer_id, stripe_refund_id, settlement_error",
            )
            .not("release_attempt_id", "is", null)
            .or("release_outcome.is.null,release_outcome.neq.succeeded")
            .order("id")
            .range(from, to),
        ),
      })),
    ),
    collectPages((from, to) =>
      db
        .from("engagements")
        .select("id, settlement_hold_at")
        .eq("status", "active")
        .not("settlement_hold_at", "is", null)
        .order("id")
        .range(from, to),
    ),
  ]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Settlement recovery</h1>
      <p>
        Verify uncertain outcomes before retrying. Retrying a saved request can
        move funds. Resetting an attempt allows the normal settlement flow to
        try again.
      </p>
      {groups.every((group) => !group.rows.length) && (
        <p>No payment attempts need recovery.</p>
      )}
      {groups.flatMap(({ ledger, rows }) =>
        rows.map((row) => {
          const view = deriveRecoveryView(row);
          return (
            <section
              key={`${ledger}-${row.id}`}
              className="rounded-xl border bg-white p-5"
            >
              <h2 className="font-bold">
                {ledger === "transactions"
                  ? "Job payment"
                  : "Engagement payment"}{" "}
                · {view.label}
              </h2>
              <p className="break-all text-sm text-slate-600">
                Payment: {row.id}
              </p>
              {row.settlement_error && (
                <p className="mt-2 text-sm">{row.settlement_error}</p>
              )}
              <RecoveryActions
                id={row.id}
                ledger={ledger}
                attemptId={row.release_attempt_id!}
                canReset={view.canReset}
                canRetry={view.canRetry}
              />
            </section>
          );
        }),
      )}
      <h2 className="text-xl font-bold">Settlement holds</h2>
      <p>
        Resolve disputed or incomplete payments before resuming an engagement.
      </p>
      {!holds.length && <p>No settlement holds.</p>}
      {holds.map((hold) => (
        <section key={hold.id} className="rounded-xl border bg-white p-5">
          <p className="break-all">Engagement: {hold.id}</p>
          <RecoveryActions id={hold.id} />
        </section>
      ))}
    </div>
  );
}
