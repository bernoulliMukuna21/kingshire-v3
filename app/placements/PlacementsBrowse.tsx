import Link from "next/link";
import { FadeIn } from "@/components/animations";
import { listPublicPlacements } from "@/lib/db/placements";
import {
  COMPENSATION_LABELS,
  placementWorkModeSummary,
} from "@/lib/placements";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";

export default async function PlacementsBrowse() {
  const placements = await listPublicPlacements();

  if (!placements.length) {
    return (
      <EmptyState
        title="No placements yet"
        description="Check back soon for new placements."
      />
    );
  }

  return (
    <FadeIn>
      <div className="grid gap-4 sm:grid-cols-2">
        {placements.map((p) => (
          <Link key={p.id} href={`/placements/${p.id}`} className="block">
            <Card className="h-full p-5 transition hover:border-blue-200 hover:shadow-md">
              <p className="text-lg font-black text-slate-950">{p.title}</p>
              <p className="mt-0.5 text-sm font-bold text-slate-600">
                {p.organisation?.name ?? "Organisation"}
              </p>
              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-slate-500">
                <span>{placementWorkModeSummary(p)}</span>
                <span>{p.weekly_hours}h/week</span>
                <span>
                  {p.duration_weeks} week{p.duration_weeks === 1 ? "" : "s"}
                </span>
              </div>
              {p.summary && (
                <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                  {p.summary}
                </p>
              )}
              {p.compensation_types.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.compensation_types.map((type) => (
                    <span
                      key={type}
                      className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700"
                    >
                      {COMPENSATION_LABELS[type] ?? type}
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </FadeIn>
  );
}
