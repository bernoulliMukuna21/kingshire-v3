import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export default function PostJobLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="rounded-[2rem] border border-white bg-white/85 p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur">
        <LoadingBlock className="h-3 w-20 bg-blue-100" />
        <LoadingBlock className="mt-4 h-10 max-w-sm bg-slate-200/80" />
        <LoadingBlock className="mt-4 h-4 max-w-lg bg-slate-200/70" />
      </section>

      <section className="rounded-[1.75rem] border border-white bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
        <div className="space-y-5">
          <LoadingBlock className="h-12 w-full bg-slate-200/70" />
          <LoadingBlock className="h-32 w-full bg-slate-200/70" />
          <div className="grid gap-4 sm:grid-cols-2">
            <LoadingBlock className="h-12 bg-slate-200/70" />
            <LoadingBlock className="h-12 bg-slate-200/70" />
          </div>
          <LoadingBlock className="h-12 w-40 bg-blue-100" />
        </div>
      </section>
    </div>
  );
}
