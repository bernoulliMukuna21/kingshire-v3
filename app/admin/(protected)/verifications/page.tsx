import { listExperienceRecordsForReview } from "@/lib/db/placements";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AdminVerificationActions from "./AdminVerificationActions";

export default async function AdminVerificationsPage() {
  const records = await listExperienceRecordsForReview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">
          Verified experience review
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Completed placements awaiting approval before the verified badge shows
          on the Kinglancer&apos;s profile.
        </p>
      </div>

      {!records.length ? (
        <EmptyState
          title="Nothing to review"
          description="No verified experiences are awaiting approval right now."
        />
      ) : (
        <div className="space-y-4">
          {records.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">{r.title}</p>
                  <p className="mt-0.5 text-sm font-bold text-slate-600">
                    {r.kinglancer?.full_name ?? "Kinglancer"} ·{" "}
                    {r.organisation?.name ?? "Organisation"}
                  </p>
                </div>
                <AdminVerificationActions recordId={r.id} />
              </div>

              {r.categories.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.categories.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {r.summary && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Summary
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {r.summary}
                  </p>
                </div>
              )}

              {r.skills.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Skills
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    {r.skills.join(", ")}
                  </p>
                </div>
              )}

              {r.outcome && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Outcome
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {r.outcome}
                  </p>
                </div>
              )}

              {r.reference_text && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Reference
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                    {r.reference_text}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
