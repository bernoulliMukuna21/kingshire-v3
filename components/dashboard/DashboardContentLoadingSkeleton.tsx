import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export default function DashboardContentLoadingSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="overflow-hidden rounded-[2rem] border border-white bg-white/85 p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur sm:p-8">
        <LoadingBlock className="h-3 w-24 bg-blue-100" />
        <LoadingBlock className="mt-4 h-10 max-w-md bg-slate-200/80" />
        <LoadingBlock className="mt-4 h-4 max-w-xl bg-slate-200/70" />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <section
            key={item}
            className="rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50"
          >
            <LoadingBlock className="mb-4 h-10 w-10 rounded-xl bg-slate-200/80" />
            <LoadingBlock className="h-8 w-16 bg-slate-200/80" />
            <LoadingBlock className="mt-3 h-3 w-24 bg-slate-200/70" />
          </section>
        ))}
      </div>

      <section className="rounded-[1.75rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 sm:p-6">
        <LoadingBlock className="h-5 max-w-xs bg-slate-200/80" />
        <div className="mt-5 space-y-3">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="rounded-2xl bg-slate-50 p-4">
              <LoadingBlock className="h-4 w-3/4 bg-slate-200/80" />
              <LoadingBlock className="mt-3 h-3 w-1/2 bg-slate-200/60" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
