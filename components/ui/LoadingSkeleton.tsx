import { cn } from "@/lib/utils";

export function LoadingBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-2xl bg-slate-200/80", className)}
    />
  );
}
