import { requireAdminPage } from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";
import { collectPages } from "@/lib/db/pagination";
import { deriveRecoveryView } from "@/lib/settlement/recovery-view";
import Link from "next/link";
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
              "id, release_attempt_id, release_outcome, release_dispatch_started_at, release_failure_code, release_idempotency_key, stripe_transfer_id, stripe_refund_id, settlement_error, worker:profiles!kinglancer_id(full_name)",
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
      <div>
        <h2 className="text-xl font-bold">Payments that need help</h2>
        <p className="mt-2 text-sm text-slate-500">
          Payments that stopped or whose result still needs checking appear
          here. Payments waiting for approval are listed under Payouts.
        </p>
      </div>
      {groups.every((group) => !group.rows.length) && !holds.length && (
        <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6">
          <h3 className="font-bold text-emerald-900">
            No stopped payments to sort out
          </h3>
          <p className="mt-2 text-sm text-emerald-800">
            There are no failed payment attempts or paused ongoing payments in
            our records.
          </p>
        </section>
      )}
      {groups.flatMap(({ ledger, rows }) =>
        rows.map((row) => {
          const view = deriveRecoveryView(row);
          const worker = Array.isArray(row.worker) ? row.worker[0] : row.worker;
          return (
            <section
              id={row.id}
              key={`${ledger}-${row.id}`}
              className="rounded-xl border bg-white p-5"
            >
              <h3 className="font-bold">{view.label}</h3>
              <p className="mt-1 text-sm text-slate-500">
                {worker?.full_name ?? "Worker name not available"} ·{" "}
                {ledger === "transactions"
                  ? "One-off job payment"
                  : "Ongoing work payment"}
              </p>
              <p className="mt-3 text-sm text-slate-600">{view.explanation}</p>
              <p className="mt-3 text-sm font-medium">
                Next step: {view.nextStep}
              </p>
              <Link
                className="mt-4 inline-block text-sm font-semibold text-blue-600"
                href={`/admin/finance/payments/${ledger}/${row.id}`}
              >
                View payment details →
              </Link>
              <details className="mt-5 border-t border-slate-100 pt-4">
                <summary className="cursor-pointer text-sm text-slate-500">
                  Support tools
                </summary>
                <p className="mt-3 break-all text-xs text-slate-500">
                  Payment reference: {row.id}
                </p>
                {row.settlement_error && (
                  <p className="mt-2 text-xs text-slate-500">
                    {row.settlement_error}
                  </p>
                )}
                <RecoveryActions
                  id={row.id}
                  ledger={ledger}
                  attemptId={row.release_attempt_id!}
                  canReset={view.canReset}
                  canRetry={view.canRetry}
                />
              </details>
            </section>
          );
        }),
      )}
      {holds.length > 0 && (
        <h2 className="text-xl font-bold">Ongoing payments on pause</h2>
      )}
      {holds.map((hold) => (
        <section
          id={hold.id}
          key={hold.id}
          className="rounded-xl border bg-white p-5"
        >
          <h3 className="font-bold">Payments are paused</h3>
          <p className="mt-2 text-sm text-slate-600">
            Ask support to review disputed or incomplete payments before
            restarting payments for this work.
          </p>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-500">
              Support tools
            </summary>
            <p className="mt-3 break-all text-xs text-slate-500">
              Work reference: {hold.id}
            </p>
            <RecoveryActions id={hold.id} />
          </details>
        </section>
      ))}
    </div>
  );
}
