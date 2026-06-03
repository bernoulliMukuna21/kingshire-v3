import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  count?: number | string;
  tone?: "slate" | "red";
  children: ReactNode;
};

export default function AdminPanel({
  title,
  description,
  count,
  tone = "slate",
  children,
}: Props) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        tone === "red" && "border-red-100 ring-red-100/60",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6",
          tone === "red"
            ? "border-red-50 bg-red-50"
            : "border-gray-50 bg-white/80",
        )}
      >
        <div>
          <h2
            className={cn(
              "font-bold",
              tone === "red" ? "text-red-900" : "text-gray-900",
            )}
          >
            {title}
          </h2>
          {description && (
            <p
              className={cn(
                "mt-0.5 text-xs",
                tone === "red" ? "text-red-500" : "text-gray-400",
              )}
            >
              {description}
            </p>
          )}
        </div>
        {count !== undefined && (
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-bold",
              tone === "red"
                ? "bg-red-100 text-red-600"
                : "bg-slate-100 text-slate-500",
            )}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}
