export const dynamic = "force-dynamic";
import Link from "next/link";
import { getAdminDb } from "@/lib/admin/access";
import {
  ADMIN_PAGE_SIZE,
  getPageNumber,
  getPageRange,
  type AdminJob,
} from "@/lib/admin-dashboard";
import { jobPriceLabel, jobStatusPill } from "@/lib/jobs";
import { placementStatusPill } from "@/lib/placements";
import { coerceNumericList } from "@/lib/db/coerce";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminPagination from "@/components/admin/AdminPagination";

export default async function AdminWork({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const db = await getAdminDb();
  const params = await searchParams;
  const tab = ["roles", "placements"].includes(params.tab ?? "")
    ? params.tab!
    : "jobs";
  const page = getPageNumber(params.page);
  const { from, to } = getPageRange(page);
  const q = (params.q ?? "")
    .slice(0, 100)
    .replace(/[%_,()]/g, " ")
    .trim();
  const status = params.status ?? "";
  const statusOptions =
    tab === "placements"
      ? ["draft", "pending_review", "open", "closed", "cancelled"]
      : [
          "open",
          "in_progress",
          "completed",
          "approved",
          "disputed",
          "cancelled",
        ];
  const selectedStatus = statusOptions.includes(status) ? status : "";
  let content;
  let total = 0;
  let unavailable = false;
  if (tab === "placements") {
    let query = db
      .from("placements")
      .select("id,title,status,created_at", { count: "exact" });
    if (q) query = query.ilike("title", `%${q}%`);
    if (selectedStatus) query = query.eq("status", selectedStatus);
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    total = result.count ?? 0;
    unavailable = !!result.error;
    content = result.data?.map((row) => (
      <Link
        key={row.id}
        href={`/placements/${row.id}`}
        className="block border-t border-slate-100 p-5"
      >
        <p className="font-semibold">{row.title}</p>
        <p className="mt-1 text-xs text-slate-500">
          {placementStatusPill(row.status, 0).label}
        </p>
      </Link>
    ));
  } else {
    let query = db
      .from("jobs")
      .select(
        "id,title,status,budget,posting_type,pay_negotiable,pay_amount,pay_cadence,created_at,client:profiles!client_id(full_name)",
        { count: "exact" },
      );
    query =
      tab === "roles"
        ? query.eq("posting_type", "role")
        : query.or("posting_type.is.null,posting_type.neq.role");
    if (q) query = query.ilike("title", `%${q}%`);
    if (selectedStatus) query = query.eq("status", selectedStatus);
    const result = await query
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to);
    total = result.count ?? 0;
    unavailable = !!result.error;
    const rows = coerceNumericList(
      (result.data ?? []) as unknown as AdminJob[],
      ["budget", "pay_amount"],
    );
    content = rows.map((row) => (
      <Link
        key={row.id}
        href={`/jobs/${row.id}`}
        className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-5"
      >
        <div>
          <p className="font-semibold">{row.title}</p>
          <p className="mt-1 text-xs text-slate-500">
            {row.client?.full_name ?? "Client"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2 py-1 text-xs ${jobStatusPill(row.status).className}`}
          >
            {jobStatusPill(row.status).label}
          </span>
          <span className="text-sm font-bold">{jobPriceLabel(row)}</span>
        </div>
      </Link>
    ));
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Work</h1>
        <p className="mt-2 text-sm text-slate-500">
          Browse jobs, organisation roles and placements.
        </p>
      </div>
      <AdminTabs
        selected={tab}
        tabs={[
          { label: "Jobs", value: "jobs" },
          { label: "Roles", value: "roles" },
          { label: "Placements", value: "placements" },
        ].map((item) => ({ ...item, href: `/admin/jobs?tab=${item.value}` }))}
      />
      <form className="flex flex-wrap gap-3" method="get">
        <input type="hidden" name="tab" value={tab} />
        <input
          aria-label="Search work"
          name="q"
          defaultValue={q}
          placeholder="Search by title"
          className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
        />
        <select
          aria-label="Filter status"
          name="status"
          defaultValue={selectedStatus}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {statusOptions.map((value) => (
            <option key={value} value={value}>
              {tab === "placements"
                ? placementStatusPill(value, 0).label
                : jobStatusPill(value).label}
            </option>
          ))}
        </select>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Apply
        </button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <p className="p-5 text-sm text-slate-500">
          {unavailable
            ? "Work records unavailable. Refresh to try again."
            : `${total} matching records`}
        </p>
        {!unavailable && content}
        {!unavailable && total === 0 && (
          <p className="p-5 text-sm text-slate-500">
            No work matches these filters.
          </p>
        )}
      </section>
      {!unavailable && (
        <AdminPagination
          basePath="/admin/jobs"
          params={{ tab, q, status: selectedStatus }}
          page={page}
          total={total}
          pageSize={ADMIN_PAGE_SIZE}
        />
      )}
    </div>
  );
}
