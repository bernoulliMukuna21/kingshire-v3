import Pagination from "@/components/ui/Pagination";

type Props = {
  basePath: string;
  page: number;
  total: number;
  pageSize: number;
  tab: string;
};

/**
 * Conditional pagination footer shared across job list views.
 * Renders nothing when all items fit on a single page — no "Showing all X"
 * noise in the UI.
 */
export default function JobsPagination({
  basePath,
  page,
  total,
  pageSize,
  tab,
}: Props) {
  if (total <= pageSize) return null;
  return (
    <div className="overflow-hidden rounded-3xl border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
      <Pagination
        basePath={basePath}
        page={page}
        total={total}
        pageSize={pageSize}
        itemLabel="jobs"
        params={{ tab }}
      />
    </div>
  );
}
