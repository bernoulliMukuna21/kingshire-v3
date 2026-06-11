import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";

type Tone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

const iconToneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-500",
  purple: "bg-purple-50 text-purple-700",
};

export type ActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  badge: string;
  tone: Tone;
  meta?: string;
};

export function ActionCentreHeader({
  roleLabel,
  actionCount,
}: {
  roleLabel: string;
  actionCount: number;
}) {
  return (
    <PageHeader
      eyebrow={roleLabel}
      title="Action Centre"
      description={
        actionCount > 0
          ? "Review items that need a reply, decision, or payment action."
          : "Nothing needs your direct attention right now."
      }
    />
  );
}

export function ActionSummary({
  actionCount,
  waitingCount = 0,
}: {
  actionCount: number;
  waitingCount?: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Needs action
        </p>
        <p className="mt-2 text-3xl font-black text-slate-950">
          {actionCount}
        </p>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Waiting on others
        </p>
        <p className="mt-2 text-3xl font-black text-slate-950">
          {waitingCount}
        </p>
      </Card>
    </div>
  );
}

export function ActionSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {description}
          </p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ActionItemCard({ item }: { item: ActionItem }) {
  return (
    <Link href={item.href} className="group block">
      <Card
        interactive
        className="grid gap-4 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:p-6"
      >
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            iconToneClasses[item.tone],
          )}
        >
          {item.icon}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black text-slate-950 transition-colors group-hover:text-blue-700">
              {item.title}
            </h3>
            <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {item.description}
          </p>
          {item.meta && (
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {item.meta}
            </p>
          )}
        </div>
        <ChevronRight
          size={18}
          className="hidden text-slate-300 transition-colors group-hover:text-blue-500 sm:block"
        />
      </Card>
    </Link>
  );
}

export function WaitingItemCard({ item }: { item: ActionItem }) {
  return (
    <Card className="grid gap-4 p-5 opacity-90 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl",
          iconToneClasses[item.tone],
        )}
      >
        {item.icon}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-black text-slate-950">
            {item.title}
          </h3>
          <StatusBadge tone={item.tone}>{item.badge}</StatusBadge>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          {item.description}
        </p>
        {item.meta && (
          <p className="mt-2 text-xs font-semibold text-slate-400">
            {item.meta}
          </p>
        )}
      </div>
    </Card>
  );
}
