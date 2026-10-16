import { getAdminDb } from "@/lib/admin/access";
export const dynamic = "force-dynamic";

import { getPendingManualAttempts } from "@/lib/db/payment-attempts";
import { getManualPayoutQueue } from "@/lib/db/transactions";
import { payoutProviderLabel } from "@/lib/payout-links";
import { timeAgo } from "@/lib/admin-dashboard";
import { Card } from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { formatMoneyPrecise as formatMoney } from "@/lib/utils";
import {
  ConfirmFundsButton,
  RecordPayoutButton,
} from "@/app/admin/(protected)/manual-payments/ManualPaymentActions";

export default async function AdminManualPaymentsPage({
  section,
}: { section?: "incoming" | "payouts" } = {}) {
  await getAdminDb();
  const [awaitingFunds, awaitingPayout] = await Promise.all([
    getPendingManualAttempts(),
    getManualPayoutQueue(),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          section === "incoming"
            ? "Incoming bank funds"
            : section === "payouts"
              ? "External worker payouts"
              : "Manual payment workflows"
        }
        description="Check bank receipts before confirming funds. Record worker payouts only after sending the money; card funding and manual payout are separate routes."
      />

      {section !== "payouts" && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Awaiting funds ({awaitingFunds.length})
          </h2>
          {awaitingFunds.length === 0 ? (
            <EmptyState
              title="Nothing awaiting funds"
              description="Bank-transfer payments a client has started will appear here."
            />
          ) : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {awaitingFunds.map((a) => (
                <div
                  key={a.id}
                  id={a.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{a.jobTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.clientName ?? "Client"} → {a.workerName ?? "Worker"} ·
                      ref <span className="font-mono">{a.id.slice(0, 8)}</span>
                    </p>
                    {a.clientMarkedPaidAt && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                        Client says sent · {timeAgo(a.clientMarkedPaidAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black">
                      {formatMoney(a.amount + a.platformFeeClient)}
                    </span>
                    <ConfirmFundsButton attemptId={a.id} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {section !== "incoming" && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Awaiting payout ({awaitingPayout.length})
          </h2>
          {awaitingPayout.length === 0 ? (
            <EmptyState
              title="Nothing awaiting payout"
              description="Approved jobs awaiting an external worker payout will appear here."
            />
          ) : (
            <Card className="divide-y divide-slate-100 overflow-hidden">
              {awaitingPayout.map((p) => (
                <div
                  key={p.jobId}
                  id={p.jobId}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{p.jobTitle}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pay {p.workerName ?? "worker"}
                      {p.workerEmail ? ` · ${p.workerEmail}` : ""}
                    </p>
                    {p.payoutLink ? (
                      <a
                        href={p.payoutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"
                      >
                        {payoutProviderLabel(p.payoutProvider ?? "")}:{" "}
                        {p.payoutLink}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs font-bold text-amber-700">
                        No payout link on file — ask the worker to add one in
                        their profile.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-emerald-600">
                      {formatMoney(p.netAmount)}
                    </span>
                    <RecordPayoutButton
                      jobId={p.jobId}
                      defaultReference={p.reference}
                    />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
