import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CreditCard,
  GraduationCap,
  Send,
  Star,
  Users,
} from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/utils";
import type { ActionCentreItem, ActionIcon } from "@/lib/action-centre";

type Tone = "blue" | "green" | "amber" | "red" | "slate" | "purple";

const iconToneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-500",
  purple: "bg-purple-50 text-purple-700",
};

const ctaStripClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 border-t border-blue-100",
  green: "bg-emerald-50 text-emerald-700 border-t border-emerald-100",
  amber: "bg-amber-50 text-amber-700 border-t border-amber-100",
  red: "bg-red-50 text-red-700 border-t border-red-100",
  slate: "bg-slate-50 text-slate-600 border-t border-slate-100",
  purple: "bg-purple-50 text-purple-700 border-t border-purple-100",
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
  const hasActions = actionCount > 0;
  const hasWaiting = waitingCount > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card
        className={cn(
          "p-5",
          hasActions &&
            "border-amber-200 bg-amber-50/80 ring-amber-200/70 shadow-amber-900/5",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {hasActions ? "Needs action" : "No action needed"}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {hasActions ? actionCount : "Clear"}
            </p>
          </div>
          {!hasActions && (
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          )}
        </div>
      </Card>
      <Card
        className={cn(
          "p-5",
          hasWaiting &&
            "border-blue-100 bg-blue-50/60 ring-blue-100 shadow-blue-900/5",
        )}
      >
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

export function ActionCentreSummaryCard({
  actionCount,
  waitingCount = 0,
  waitingOnLabel = "others",
  actionDescription = "Open Action Centre to review items that need a reply, decision, approval, or payment action.",
  idleDescription = "Items that need your reply, approval, or payment action will appear here.",
}: {
  actionCount: number;
  waitingCount?: number;
  waitingOnLabel?: string;
  actionDescription?: string;
  idleDescription?: string;
}) {
  const hasActions = actionCount > 0;
  const hasWaiting = !hasActions && waitingCount > 0;

  const title = hasActions
    ? `${actionCount} item${actionCount !== 1 ? "s" : ""} need action`
    : hasWaiting
      ? "No action needed from you"
      : "You are all caught up";

  const description = hasActions
    ? actionDescription
    : hasWaiting
      ? `${waitingCount} item${waitingCount !== 1 ? "s are" : " is"} waiting on ${waitingOnLabel}.`
      : idleDescription;

  return (
    <Link href="/dashboard/action-centre" className="group block">
      <Card
        interactive
        className={cn(
          "flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
          hasActions &&
            "border-amber-200 bg-amber-50/80 ring-amber-200/70 shadow-amber-900/5 hover:border-amber-300",
          hasWaiting &&
            "border-blue-100 bg-blue-50/60 ring-blue-100 shadow-blue-900/5 hover:border-blue-200",
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
              hasActions
                ? "bg-amber-100 text-amber-700"
                : hasWaiting
                  ? "bg-blue-100 text-blue-700"
                  : "bg-blue-50 text-blue-600",
            )}
          >
            {hasActions ? (
              <AlertCircle size={18} />
            ) : hasWaiting ? (
              <Clock3 size={18} />
            ) : (
              <CheckCircle2 size={18} />
            )}
          </div>
          <div>
            <p className="font-black text-slate-950">{title}</p>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <span
          className={cn(
            "text-sm font-bold transition-colors",
            hasActions
              ? "text-amber-700 group-hover:text-amber-800"
              : "text-blue-600 group-hover:text-blue-700",
          )}
        >
          Open Action Centre
        </span>
      </Card>
    </Link>
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
          <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function ActionItemCard({ item }: { item: ActionItem }) {
  return (
    <Link href={item.href} className="group block">
      <Card interactive className="overflow-hidden p-0">
        {/* ── Mobile layout ── */}
        <div className="sm:hidden">
          <div className="flex items-start gap-3 p-4">
            <div
              className={cn(
                "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                iconToneClasses[item.tone],
              )}
            >
              {item.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-black leading-tight text-slate-950">
                {item.title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {item.description}
              </p>
              {item.meta && (
                <p className="mt-1.5 text-xs font-semibold text-slate-400">
                  {item.meta}
                </p>
              )}
            </div>
          </div>
          {/* Tap-target CTA strip */}
          <div
            className={cn(
              "flex items-center justify-between rounded-b-3xl px-4 py-3",
              ctaStripClasses[item.tone],
            )}
          >
            <span className="text-sm font-bold">{item.badge}</span>
            <ChevronRight size={16} className="shrink-0" />
          </div>
        </div>

        {/* ── Desktop layout ── */}
        <div className="hidden sm:grid sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-6 sm:p-6">
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
            className="text-slate-300 transition-colors group-hover:text-blue-500"
          />
        </div>
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

const ICONS: Record<ActionIcon, ReactNode> = {
  review: <Star size={18} />,
  "review-work": <CheckCircle2 size={18} />,
  applicants: <Users size={18} />,
  request: <Send size={18} />,
  payment: <CreditCard size={18} />,
  placement: <GraduationCap size={18} />,
  alert: <AlertCircle size={18} />,
};

/** Append an Action Centre source tag, preserving any `#fragment`. */
function withSource(href: string, from: string): string {
  const [path, fragment] = href.split("#");
  const sep = path.includes("?") ? "&" : "?";
  const decorated = `${path}${sep}from=${from}`;
  return fragment ? `${decorated}#${fragment}` : decorated;
}

function toActionItem(item: ActionCentreItem, from: string | null): ActionItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    href: from ? withSource(item.href, from) : item.href,
    icon: ICONS[item.icon],
    badge: item.badge,
    tone: item.tone,
    meta: item.meta,
  };
}

/** Renders action-centre items into Needs action + Waiting sections. Shared by
 * the personal Action Centre page and the organisation workspace. `from` tags
 * links so the destination shows a "Back to Action Centre" link; pass `null`
 * (e.g. from the org workspace) to leave links undecorated. */
export function ActionItemsView({
  items,
  from = "action-centre",
}: {
  items: ActionCentreItem[];
  from?: string | null;
}) {
  const actionItems = items
    .filter((item) => item.kind === "action")
    .map((item) => toActionItem(item, from));
  const waitingItems = items
    .filter((item) => item.kind === "waiting")
    .map((item) => toActionItem(item, from));

  return (
    <div className="space-y-8">
      {actionItems.length > 0 && (
        <ActionSection
          title="Needs action"
          description="These items are waiting for you."
        >
          {actionItems.map((item) => (
            <ActionItemCard key={item.id} item={item} />
          ))}
        </ActionSection>
      )}
      {waitingItems.length > 0 && (
        <ActionSection
          title="Waiting on others"
          description="These are useful to track, but they do not need action from you right now."
        >
          {waitingItems.map((item) => (
            <WaitingItemCard key={item.id} item={item} />
          ))}
        </ActionSection>
      )}
    </div>
  );
}
