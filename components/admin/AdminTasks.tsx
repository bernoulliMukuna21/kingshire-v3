import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import type { AdminTask } from "@/lib/admin/action-view";
import { timeAgo } from "@/lib/admin-dashboard";

export function AdminQueueWarning({ unavailable }: { unavailable: string[] }) {
  if (!unavailable.length) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
    >
      Some queues are unavailable ({unavailable.join(", ")}). Tasks and counts
      are incomplete. Refresh to try again.
    </p>
  );
}
export default function AdminTasks({
  items,
  empty = "Nothing needs attention right now.",
}: {
  items: AdminTask[];
  empty?: string;
}) {
  if (!items.length)
    return (
      <p className="rounded-2xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
        {empty}
      </p>
    );
  return (
    <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-white">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className="flex items-start gap-4 p-5 transition hover:bg-slate-50"
        >
          <span
            className={`mt-0.5 rounded-xl p-2.5 ${item.kind === "waiting" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-700"}`}
          >
            <Clock3 size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-950">{item.title}</p>
            <p className="mt-1 text-sm text-slate-500">{item.description}</p>
            <p className="mt-2 text-xs text-slate-400">
              {item.category} · {timeAgo(item.createdAt)} ·{" "}
              {item.kind === "waiting" ? "Waiting" : "Needs attention"}
            </p>
          </div>
          <ArrowRight size={17} className="mt-1 shrink-0 text-slate-400" />
        </Link>
      ))}
    </div>
  );
}
