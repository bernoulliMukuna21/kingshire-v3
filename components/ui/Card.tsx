import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type Props = ComponentPropsWithoutRef<"div"> & {
  interactive?: boolean;
};

export function Card({ className, interactive = false, ...props }: Props) {
  return (
    <div
      className={cn(
        "rounded-[1.5rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 backdrop-blur",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-2xl hover:shadow-blue-950/10",
        className,
      )}
      {...props}
    />
  );
}

export const cardPadding = "p-5 sm:p-6";
