import { LoadingBlock } from "@/components/ui/LoadingSkeleton";
export default function AdminContentLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading admin workspace">
      <section className="rounded-3xl bg-emerald-950 p-8">
        <LoadingBlock className="h-3 w-44 bg-emerald-800" />
        <LoadingBlock className="mt-6 h-16 max-w-xs bg-emerald-800" />
        <LoadingBlock className="mt-5 h-4 max-w-lg bg-emerald-900" />
      </section>
      <div className="grid grid-cols-2 gap-5 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key}>
            <LoadingBlock className="h-7 w-14 bg-slate-200" />
            <LoadingBlock className="mt-3 h-3 w-24 bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((key) => (
          <section
            key={key}
            className="rounded-2xl border border-slate-100 bg-white p-5"
          >
            <LoadingBlock className="h-4 max-w-sm bg-slate-200" />
            <LoadingBlock className="mt-3 h-3 max-w-lg bg-slate-100" />
          </section>
        ))}
      </div>
    </div>
  );
}
