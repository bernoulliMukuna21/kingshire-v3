import Link from "next/link";
import { getAdminDb } from "@/lib/admin/access";
import {
  getPageNumber,
  getPageRange,
  ADMIN_PAGE_SIZE,
} from "@/lib/admin-dashboard";
import { transactionStatusPill } from "@/lib/transactions";
import AdminTabs from "./AdminTabs";
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
  const result =
    selected === "audit"
      ? await db
          .from("settlement_recovery_audit")
          .select("id,action,reason,payment_id,ledger,created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to)
      : await db
          .from(selected)
          .select("id,status,created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to);
  return (
    <div className="space-y-4">
      <AdminTabs
        selected={selected}
        tabs={[
          { label: "One-off payments", value: "transactions" },
          { label: "Recurring payments", value: "engagement_payments" },
          { label: "Correction audit", value: "audit" },
        ].map((item) => ({
          ...item,
          href: `/admin/finance?tab=history&ledger=${item.value}`,
        }))}
      />
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        {result.error ? (
          <p role="status" className="p-5 text-amber-800">
            History unavailable. Refresh to try again.
          </p>
        ) : result.data.length ? (
          result.data.map((row) =>
            "action" in row ? (
              <div key={row.id} className="border-b border-slate-100 p-5">
                <p className="text-sm font-semibold">{row.action}</p>
                <p className="mt-1 text-sm text-slate-600">{row.reason}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {new Date(row.created_at).toLocaleString("en-GB", {
                    timeZone: "Europe/London",
                  })}
                </p>
                <Link
                  className="mt-2 inline-block text-sm text-blue-700"
                  href={
                    row.ledger === "engagements"
                      ? `/admin/settlements#${row.payment_id}`
                      : `/admin/finance/payments/${row.ledger}/${row.payment_id}`
                  }
                >
                  View payment →
                </Link>
              </div>
            ) : (
              <Link
                href={`/admin/finance/payments/${selected}/${row.id}`}
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5"
              >
                <div>
                  <p className="text-sm font-semibold">
                    Payment {row.id.slice(0, 8)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {new Date(row.created_at).toLocaleDateString("en-GB", {
                      timeZone: "Europe/London",
                    })}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs ${transactionStatusPill(row.status).className}`}
                >
                  {transactionStatusPill(row.status).label} →
                </span>
              </Link>
            ),
          )
        ) : (
          <p className="p-5 text-sm text-slate-500">No history yet.</p>
        )}
      </section>
      {!result.error && (
        <AdminPagination
          basePath="/admin/finance"
          params={{ tab: "history", ledger: selected }}
          page={page}
          total={result.count ?? 0}
          pageSize={ADMIN_PAGE_SIZE}
        />
      )}
    </div>
  );
}
