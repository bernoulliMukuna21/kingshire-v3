import Link from "next/link";
import type { Database } from "@/lib/supabase/types";
import { ArrowUpRight, ReceiptText } from "lucide-react";
import { getAdminDb } from "@/lib/admin/access";
import { getAdminPaymentHistory } from "@/lib/admin/payment-history";
import {
  getPageNumber,
  getPageRange,
  ADMIN_PAGE_SIZE,
} from "@/lib/admin-dashboard";
import { transactionStatusPill } from "@/lib/transactions";
import { formatMoneyPrecise } from "@/lib/utils";
import AdminPagination from "./AdminPagination";

export default async function AdminPaymentHistory({
  ledger = "transactions",
  page: pageParam,
}: {
  ledger?: string;
  page?: string;
}) {
  const db = await getAdminDb();
  const selected =
    ledger === "engagement_payments"
      ? "engagement_payments"
      : ledger === "audit"
        ? "audit"
        : "transactions";
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page);
  let history: Awaited<ReturnType<typeof getAdminPaymentHistory>> | null = null;
  let audit = null;
  let failed = false;
  let total = 0;
  try {
    if (selected === "audit") {
      const result = await db
        .from("settlement_recovery_audit")
        .select("id,action,reason,payment_id,ledger,created_at", {
          count: "exact",
        })
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to);
      if (result.error) throw result.error;
      audit = result.data;
      total = result.count ?? 0;
    } else {
      history = await getAdminPaymentHistory(selected, from, to);
      total = history.total;
    }
  } catch (error) {
    console.error("[admin payment history]", error);
    failed = true;
  }
  return (
    <AdminPaymentHistoryView
      selected={selected}
      page={page}
      history={history}
      audit={audit}
      failed={failed}
      total={total}
    />
  );
}

type AuditEvent = Pick<
  Database["public"]["Tables"]["settlement_recovery_audit"]["Row"],
  "id" | "action" | "reason" | "payment_id" | "ledger" | "created_at"
>;
export function AdminPaymentHistoryView({
  selected,
  page,
  history,
  audit,
  failed = false,
  total,
}: {
  selected: "transactions" | "engagement_payments" | "audit";
  page: number;
  history: Awaited<ReturnType<typeof getAdminPaymentHistory>> | null;
  audit: AuditEvent[] | null;
  failed?: boolean;
  total: number;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-5 sm:px-6">
        <div>
          <h2 className="font-bold">Payment history</h2>
          <p className="mt-1 text-xs text-slate-500">
            {failed
              ? "Records could not be loaded"
              : `${total} ${selected === "audit" ? "recorded corrections" : "payments"} · newest first`}
          </p>
        </div>
        <form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value="history" />
          <label
            htmlFor="history-source"
            className="text-xs font-medium text-slate-500"
          >
            Show
          </label>
          <select
            id="history-source"
            name="ledger"
            defaultValue={selected}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          >
            <option value="transactions">Job payments</option>
            <option value="engagement_payments">Recurring payments</option>
            <option value="audit">Corrections</option>
          </select>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
            Apply
          </button>
        </form>
      </div>
      {failed ? (
        <p role="status" className="p-6 text-sm text-amber-800">
          Payment history is temporarily unavailable. Refresh to try again.
        </p>
      ) : history ? (
        <>
          <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_8rem] gap-5 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 md:grid">
            <span>Payment / recipient</span>
            <span>Method</span>
            <span className="text-right">Worker net</span>
            <span className="text-right">Status</span>
          </div>
          {history.items.length ? (
            history.items.map((row) => {
              const status = transactionStatusPill(row.status);
              return (
                <Link
                  key={row.id}
                  href={row.href}
                  className="group grid gap-4 border-b border-slate-100 p-5 transition hover:bg-slate-50/80 sm:px-6 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_7rem_8rem] md:items-center md:gap-5"
                >
                  <div className="flex min-w-0 gap-3">
                    <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 sm:flex">
                      <ReceiptText size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {row.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {row.worker}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {new Date(row.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          timeZone: "Europe/London",
                        })}{" "}
                        · Ref {row.reference}
                        {row.period ? ` · ${row.period}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500">
                    <p>{row.funding}</p>
                    <p className="mt-1 text-slate-400">{row.payout}</p>
                  </div>
                  <p className="font-bold tabular-nums md:text-right">
                    <span className="mr-2 text-xs font-normal text-slate-400 md:hidden">
                      Worker net
                    </span>
                    {formatMoneyPrecise(row.workerNetGBP)}
                  </p>
                  <div className="flex items-center justify-between gap-2 md:justify-end">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <ArrowUpRight
                      size={15}
                      className="shrink-0 text-slate-300 group-hover:text-slate-600"
                    />
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="p-6 text-sm text-slate-500">
              No payments recorded yet.
            </p>
          )}
        </>
      ) : audit?.length ? (
        audit.map((row) => (
          <div key={row.id} className="border-b border-slate-100 p-5 sm:px-6">
            <p className="text-sm font-semibold">{row.action}</p>
            <p className="mt-1 text-sm text-slate-600">{row.reason}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                {new Date(row.created_at).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })}
              </p>
              <Link
                href={
                  row.ledger === "engagements"
                    ? `/admin/settlements#${row.payment_id}`
                    : `/admin/finance/payments/${row.ledger}/${row.payment_id}`
                }
                className="text-xs font-semibold text-blue-700"
              >
                View record →
              </Link>
            </div>
          </div>
        ))
      ) : (
        <p className="p-6 text-sm text-slate-500">No corrections recorded.</p>
      )}
      {!failed && (
        <AdminPagination
          basePath="/admin/finance"
          params={{ tab: "history", ledger: selected }}
          page={page}
          total={total}
          pageSize={ADMIN_PAGE_SIZE}
        />
      )}
    </section>
  );
}
