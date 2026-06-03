import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 ring-blue-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100",
  red: "bg-red-50 text-red-700 ring-red-100",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-100",
};

export function StatusBadge({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
