import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
/** Shared by every admin route: keep neutral so navigation never flashes
 * an unrelated overview/finance banner while another section loads. */
export default function AdminContentLoadingSkeleton() {
  return (
    <div
      className="space-y-6"
      aria-label="Loading admin workspace"
      role="status"
    >
      <div className="space-y-3">
        <LoadingBlock className="h-7 w-36 bg-slate-200" />
        <LoadingBlock className="h-3 max-w-sm bg-slate-100" />
      </div>
      <div className="flex gap-3">
        <LoadingBlock className="h-10 w-48 bg-slate-100" />
        <LoadingBlock className="h-10 w-24 bg-slate-100" />
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 p-5">
          <LoadingBlock className="h-3 w-32 bg-slate-200" />
        </div>
        {[0, 1, 2, 3].map((key) => (
          <div
            key={key}
            className="flex items-center justify-between gap-5 border-b border-slate-100 p-5"
          >
            <div className="w-2/3 space-y-3">
              <LoadingBlock className="h-4 max-w-xs bg-slate-200" />
              <LoadingBlock className="h-3 max-w-sm bg-slate-100" />
            </div>
            <LoadingBlock className="h-6 w-20 bg-slate-100" />
          </div>
        ))}
      </section>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
