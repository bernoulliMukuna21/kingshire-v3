import { cn } from "@/lib/utils";

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-2xl bg-slate-200/80",
        className,
      )}
    />
  );
}

export default function LoadingSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6", className)}>
      <LoadingBlock className="h-36 rounded-[2rem]" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
        <LoadingBlock className="h-28" />
      </div>
      <LoadingBlock className="h-72 rounded-[1.75rem]" />
    </div>
  );
}
