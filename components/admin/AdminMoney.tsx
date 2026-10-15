import Link from "next/link";
import type { getAdminFinances } from "@/lib/admin/finances";
import { formatMoneyPrecise } from "@/lib/utils";
export const adminMoney = (value: number | null | undefined) =>
  value == null ? "Unavailable" : formatMoneyPrecise(value);
export function AdminFinanceDetails({
  finances,
}: {
  finances: Awaited<ReturnType<typeof getAdminFinances>>;
}) {
  const { summary } = finances;
  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Stripe available", value: finances.availableGBP },
          { label: "Stripe worker funds held", value: summary?.stripeOwedGBP },
          {
            label: "Job-fee revenue before costs",
            value: summary?.platformFeesGBP,
          },
          {
            label: "Lifetime net earnings",
            value: summary?.platformNetProceedsGBP,
          },
        ].map((metric) => (
          <div key={metric.label}>
            <p className="text-xs text-slate-500">{metric.label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums">
              {adminMoney(metric.value)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">
        Stripe costs already deducted: {adminMoney(summary?.stripeCostsGBP)}.
        Still settling: {adminMoney(finances.pendingGBP)}. Bank-funded worker
        obligations: {adminMoney(summary?.bankOwedGBP)}. Held client fees
        reserved: {adminMoney(summary?.deferredStripeFeesGBP)}.
      </p>
      <p className="text-xs leading-relaxed text-slate-500">
        Cash includes top-ups and prior withdrawals. Revenue and earnings are
        separate from available cash. Job-fee revenue covers released one-off
        jobs; net earnings include Stripe subscriptions and recorded bank fees,
        before tax and other business expenses. These figures rely on payment
        records and are not a bank reconciliation.
      </p>
      {(!summary || summary.needsReconciliation) && (
        <p role="status" className="text-sm font-semibold text-amber-800">
          Payment records need verification. Cash estimates are unavailable.
        </p>
      )}
      {finances.reconciliation && (
        <details className="text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold">
            Payment matching:{" "}
            {finances.reconciliation.issues.length
              ? "needs attention"
              : "complete"}
          </summary>
          <ul className="mt-3 list-inside list-disc space-y-2">
            {[
              ...finances.reconciliation.issues,
              ...finances.reconciliation.differences,
            ].map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
          {!finances.reconciliation.issues.length &&
            !finances.reconciliation.differences.length && (
              <p className="mt-2">
                Receipts and worker transfers match the payment records.
              </p>
            )}
        </details>
      )}
      <Link
        href="/admin/finance"
        className="inline-block text-sm font-semibold text-blue-700"
      >
        Open finance workspace →
      </Link>
    </div>
  );
}
export default function AdminMoney({
  finances,
}: {
  finances: Awaited<ReturnType<typeof getAdminFinances>>;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-emerald-950 to-emerald-800 p-6 text-white shadow-lg shadow-emerald-950/10 sm:p-9">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-80 w-80 rounded-full bg-emerald-400/10"
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
            Platform money available
          </h1>
          {finances.testMode && (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">
              Test data · not real funds
            </span>
          )}
        </div>
        <p className="mt-5 break-words text-5xl font-black tracking-tight tabular-nums sm:text-7xl">
          {adminMoney(finances.summary?.estimatedWithdrawableGBP)}
        </p>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-emerald-100">
          Available after setting aside held client payments.
          <br />
          Stripe fees already deducted are reflected in this balance.
        </p>
        <details className="mt-7 border-t border-white/15 pt-5">
          <summary className="cursor-pointer text-sm font-semibold text-emerald-100">
            View financial details
          </summary>
          <div className="mt-4 text-slate-950">
            <AdminFinanceDetails finances={finances} />
          </div>
        </details>
      </div>
    </section>
  );
}
