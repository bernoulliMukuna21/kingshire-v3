import Link from "next/link";
import { ArrowUpRight, CircleAlert, Wallet } from "lucide-react";
import type { getAdminFinances } from "@/lib/admin/finances";
import { formatMoneyPrecise } from "@/lib/utils";
export type AdminFinances = Awaited<ReturnType<typeof getAdminFinances>>;
export const adminMoney = (value: number | null | undefined) =>
  value == null ? "Not verified" : formatMoneyPrecise(value);

/** The overview is intentionally just a balance and its destination. Finance
 * owns the breakdown, definitions and reconciliation details. */
export default function AdminMoney({ finances }: { finances: AdminFinances }) {
  const amount = finances.summary?.estimatedWithdrawableGBP;
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
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              Test mode
            </span>
          )}
        </div>
        {amount == null ? (
          <>
            <p className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">
              Balance needs review
            </p>
            <p className="mt-4 max-w-lg text-sm text-emerald-100">
              We can’t confirm available platform money until the payment
              records are checked.
            </p>
          </>
        ) : (
          <>
            <p className="mt-5 break-words text-5xl font-black tracking-tight tabular-nums sm:text-7xl">
              {adminMoney(amount)}
            </p>
            <p className="mt-4 max-w-xl text-sm text-emerald-100">
              {amount === 0
                ? "No settled funds are available after held payments."
                : "Money available to KingsHire after setting aside client and worker payments. Stripe fees already deducted."}
            </p>
          </>
        )}
        <div className="mt-7 flex items-center justify-between border-t border-white/15 pt-5">
          <span className="text-xs text-emerald-200/80">
            {finances.testMode
              ? "Test figures · not real funds"
              : "Your platform money in Stripe"}
          </span>
          <Link
            href="/admin/finance"
            className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold text-white hover:bg-white/10"
          >
            View finance <ArrowUpRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function AdminFinanceDetails({ finances }: { finances: AdminFinances }) {
  const { summary } = finances;
  const needsReview =
    !summary ||
    summary.needsReconciliation ||
    summary.platformNetProceedsGBP == null;
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-100 bg-white p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-500">
              Platform money available
            </h2>
            <p className="mt-3 text-4xl font-black tracking-tight tabular-nums">
              {adminMoney(summary?.estimatedWithdrawableGBP)}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Money left in Stripe after setting aside payments still held for
              clients and workers. Stripe fees already deducted.
            </p>
          </div>
          <span className="rounded-xl bg-emerald-50 p-3 text-emerald-700">
            <Wallet size={22} />
          </span>
        </div>
        {finances.testMode && (
          <p className="mt-4 text-xs text-slate-400">
            Test mode · these are not real funds.
          </p>
        )}
      </section>
      <div className="grid gap-4">
        {[
          {
            label: "Held for workers",
            value: summary?.stripeOwedGBP,
            detail: "Money allocated to workers, including work in progress",
          },
        ].map((metric) => (
          <section
            key={metric.label}
            className="rounded-2xl border border-slate-100 bg-white p-5"
          >
            <h3 className="text-xs font-semibold text-slate-500">
              {metric.label}
            </h3>
            <p className="mt-2 text-2xl font-black tabular-nums">
              {adminMoney(metric.value)}
            </p>
            <p className="mt-2 text-xs text-slate-400">{metric.detail}</p>
          </section>
        ))}
      </div>
      {needsReview && (
        <Link
          href="/admin/finance?tab=issues"
          className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <CircleAlert size={18} className="shrink-0" />
          <span>
            Some payment records need checking. View payment issues for details.
          </span>
          <ArrowUpRight size={17} className="ml-auto shrink-0" />
        </Link>
      )}
      {(summary?.bankOwedGBP ?? 0) > 0 && (
        <Link
          href="/admin/finance?tab=payouts"
          className="block rounded-xl bg-slate-50 p-4 text-sm text-slate-600"
        >
          Another {adminMoney(summary?.bankOwedGBP)} is recorded for workers
          outside Stripe. Review these under Payouts →
        </Link>
      )}
      {(finances.pendingGBP ?? 0) > 0 && (
        <p className="px-1 text-sm text-slate-500">
          Another {adminMoney(finances.pendingGBP)} is on its way from Stripe.
          It is not included in the available money yet.
        </p>
      )}
    </div>
  );
}

export function AdminReconciliationPanel({
  finances,
}: {
  finances: AdminFinances;
}) {
  const issues = finances.reconciliation?.issues ?? [];
  const differences = finances.reconciliation?.differences ?? [];
  const missing = !finances.reconciliation;
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Are the figures up to date?</h2>
          <p className="mt-1 text-sm text-slate-500">
            {missing
              ? "We couldn’t check the records against Stripe. Try refreshing this page."
              : issues.length
                ? "Some Stripe payments do not match our records yet. Support needs to check them before we can confirm earnings. This does not mean a customer or worker is owed money."
                : "The payment records have been checked against Stripe."}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${missing || issues.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}
        >
          {missing || issues.length ? "Needs review" : "Checked"}
        </span>
      </div>
      {(issues.length > 0 || differences.length > 0) && (
        <details className="mt-4 border-t border-slate-100 pt-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-600">
            Details for support
          </summary>
          <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto break-words text-xs leading-relaxed text-slate-500">
            {[...issues, ...differences].map((message, index) => (
              <li key={index} className="rounded-lg bg-slate-50 p-3">
                {message}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
