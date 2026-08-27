import { listPlacementsForReview } from "@/lib/db/placements";
import {
  displayPlacementCompensation,
  placementWorkModeSummary,
} from "@/lib/placements";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminPlacementActions from "./AdminPlacementActions";

function formatDate(value: string | null) {
  return value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
}

export default async function AdminPlacementsPage() {
  const placements = await listPlacementsForReview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">Placement review</h1>
        <p className="mt-1 text-sm text-slate-500">
          Experience placements awaiting a safety review before they go live.
        </p>
      </div>

      {!placements.length ? (
        <EmptyState
          title="Nothing to review"
          description="No placements are awaiting review right now."
        />
      ) : (
        <div className="space-y-4">
          {placements.map((p) => {
            const dateRange = [formatDate(p.start_date), formatDate(p.end_date)]
              .filter(Boolean)
              .join(" → ");
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-slate-950">
                      {p.title}
                    </p>
                    <p className="mt-0.5 text-sm font-bold text-slate-600">
                      {p.organisation?.name ?? "Organisation"}
                    </p>
                  </div>
                  <AdminPlacementActions placementId={p.id} />
                </div>

                {p.summary && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Summary
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                      {p.summary}
                    </p>
                  </div>
                )}

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Work mode
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {placementWorkModeSummary(p)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Weekly hours
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {p.weekly_hours} hours per week
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Duration
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {p.duration_weeks} week{p.duration_weeks === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Runs from
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {dateRange || "Not set"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      Categories
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      {p.categories.join(", ")}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Contribution
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {p.contribution}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Compensation
                  </p>
                  {p.compensation_types.length ? (
                    <ul className="mt-2 space-y-1.5">
                      {displayPlacementCompensation(p).map((item) => (
                        <li
                          key={item.type}
                          className="flex flex-wrap items-baseline gap-2 text-sm"
                        >
                          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                            {item.label}
                          </span>
                          <span className="text-slate-700">{item.detail}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-slate-400">
                      None specified.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
