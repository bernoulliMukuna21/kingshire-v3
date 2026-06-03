import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export default function AdminContentLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white bg-white/80 p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
        <div className="mb-3 h-3 w-20 rounded-full bg-blue-100" />
        <LoadingBlock className="h-10 max-w-sm bg-slate-200/80" />
        <LoadingBlock className="mt-4 h-4 max-w-xl bg-slate-200/70" />
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="rounded-[1.5rem] border border-white bg-white/90 p-5 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50"
          >
            <LoadingBlock className="mb-4 h-10 w-10 rounded-xl bg-slate-200/80" />
            <LoadingBlock className="h-8 w-16 bg-slate-200/80" />
            <LoadingBlock className="mt-3 h-3 w-24 bg-slate-200/70" />
            <LoadingBlock className="mt-2 h-3 w-32 bg-slate-200/60" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {[0, 1, 2].map((panel) => (
          <section
            key={panel}
            className="overflow-hidden rounded-[1.5rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50"
          >
            <div className="border-b border-gray-50 px-5 py-4 sm:px-6">
              <LoadingBlock className="h-4 w-32 bg-slate-200/80" />
              <LoadingBlock className="mt-2 h-3 w-44 bg-slate-200/60" />
            </div>
            <div className="divide-y divide-gray-50">
              {[0, 1, 2].map((row) => (
                <div key={row} className="px-5 py-4 sm:px-6">
                  <LoadingBlock className="h-4 w-3/4 bg-slate-200/80" />
                  <LoadingBlock className="mt-2 h-3 w-1/2 bg-slate-200/60" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
