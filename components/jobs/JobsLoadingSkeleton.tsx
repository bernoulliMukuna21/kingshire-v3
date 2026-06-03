import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export function JobsIndexLoadingSkeleton() {
  return (
    <>
      <section className="relative overflow-hidden bg-[#10234b] px-4 pb-12 pt-24 text-white sm:px-6 sm:pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.22),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.3),transparent_34%)]" />
        <div className="relative mx-auto max-w-6xl">
          <LoadingBlock className="h-12 max-w-sm bg-white/15" />
          <LoadingBlock className="mt-4 h-4 max-w-xl bg-white/10" />
          <LoadingBlock className="mt-2 h-4 max-w-md bg-white/10" />
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex gap-3">
            <LoadingBlock className="h-12 flex-1 rounded-2xl bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50" />
            <LoadingBlock className="h-12 w-12 rounded-2xl bg-white shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50" />
          </div>

          <div className="-mx-4 flex gap-2 overflow-hidden px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <LoadingBlock
                key={item}
                className={`h-10 shrink-0 rounded-2xl bg-white ring-1 ring-slate-200/50 ${
                  item === 0 ? "w-16" : item === 2 ? "w-40" : "w-28"
                }`}
              />
            ))}
          </div>

          <div className="mb-4 mt-6">
            <LoadingBlock className="h-4 w-28 bg-slate-200/70" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <article
                key={item}
                className="rounded-[1.5rem] border border-white bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50"
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <LoadingBlock className="h-5 w-3/4 bg-slate-200/80" />
                    <LoadingBlock className="mt-3 h-4 w-1/2 bg-slate-200/60" />
                  </div>
                  <LoadingBlock className="h-6 w-20 bg-green-100" />
                </div>

                <div className="mb-4 flex flex-wrap gap-2">
                  <LoadingBlock className="h-7 w-24 rounded-full bg-blue-50" />
                  <LoadingBlock className="h-7 w-20 rounded-full bg-blue-50" />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <LoadingBlock className="h-3 w-20 bg-slate-200/60" />
                  <div className="flex items-center gap-2">
                    <LoadingBlock className="h-5 w-5 rounded-full bg-slate-200/80" />
                    <LoadingBlock className="h-3 w-24 bg-slate-200/60" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
