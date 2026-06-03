import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function PageHeader({
  eyebrow,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[2rem] bg-[#10234b] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_34%)]" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          {eyebrow && (
            <span className="mb-4 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-100 ring-1 ring-white/15">
              {eyebrow}
            </span>
          )}
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {title}
          </h1>
          {description && (
            <p className="mt-3 text-sm leading-6 text-white/70 sm:text-base">
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
