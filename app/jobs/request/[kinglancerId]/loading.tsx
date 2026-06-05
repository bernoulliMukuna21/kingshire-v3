import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export default function RequestKinglancerLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-20 pb-12 sm:px-6 lg:px-8">
      <LoadingBlock className="h-4 w-44" />

      <section className="rounded-[1.75rem] border border-white bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
        <div className="space-y-5">
          <LoadingBlock className="h-14 w-full rounded-2xl" />
          <LoadingBlock className="h-12 w-full bg-slate-200/70" />
          <LoadingBlock className="h-32 w-full bg-slate-200/70" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingBlock key={i} className="h-8 w-24 rounded-full bg-slate-200/70" />
            ))}
          </div>
          <LoadingBlock className="h-12 w-full bg-slate-200/70" />
          <LoadingBlock className="h-12 w-full bg-blue-100 rounded-xl" />
        </div>
      </section>
    </div>
  );
}
