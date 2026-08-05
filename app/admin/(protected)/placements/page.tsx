import { listPlacementsForReview } from "@/lib/db/placements";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminPlacementActions from "./AdminPlacementActions";

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
          {placements.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-black text-slate-950">{p.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.organisation?.name ?? "Organisation"} · {p.weekly_hours}
                    h/week · {p.duration_weeks} weeks · {p.categories.join(", ")}
                  </p>
                </div>
                <AdminPlacementActions placementId={p.id} />
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Contribution
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {p.contribution}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Value offered
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-700">
                    {p.reward}
                  </p>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-600">
                {p.summary}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
