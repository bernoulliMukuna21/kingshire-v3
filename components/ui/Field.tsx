import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

type InputProps = ComponentPropsWithoutRef<"input"> & {
  label?: string;
  help?: string;
  rightSlot?: ReactNode;
};

export const fieldClasses =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm shadow-slate-900/5 transition-all placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

export function Field({
  label,
  help,
  rightSlot,
  className,
  ...props
}: InputProps) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-xs font-bold text-slate-700">
          {label}
        </span>
      )}
      <span className="relative block">
        <input
          className={cn(fieldClasses, rightSlot ? "pr-10" : undefined, className)}
          {...props}
        />
        {rightSlot}
      </span>
      {help && <span className="mt-1 block text-xs text-slate-400">{help}</span>}
    </label>
  );
}
