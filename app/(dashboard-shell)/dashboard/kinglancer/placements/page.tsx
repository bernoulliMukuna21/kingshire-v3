import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import {
  listKinglancerAgreements,
  listKinglancerApplications,
  listOpenPlacements,
} from "@/lib/db/placements";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import ApplyButton from "./ApplyButton";
import AgreementActions from "./AgreementActions";

export default async function KinglancerPlacementsPage() {
  const { user, profile } = await getDashboardContext();
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

  const [open, applications, agreements] = await Promise.all([
    listOpenPlacements(),
    listKinglancerApplications(user.id),
    listKinglancerAgreements(user.id),
  ]);

  const appliedIds = new Set(applications.map((a) => a.placement_id));
  const pending = agreements.filter((a) => a.status === "pending_acceptance");
  const active = agreements.filter((a) => a.status === "active");

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Placements"
        description="Supervised opportunities offering mentoring, training and a verified experience record. These are not paid jobs."
      />

      {pending.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Awaiting your acceptance
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {pending.map((a) => (
              <div key={a.id} className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-slate-950">
                    {a.placement?.title ?? "Placement"}
                  </p>
                  <AgreementActions agreementId={a.id} />
                </div>
                <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-slate-800">
                      You will contribute
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">
                      {a.contribution_terms}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">
                      You will receive
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{a.reward_terms}</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {a.weekly_hours}h/week · {a.duration_weeks} weeks
                </p>
              </div>
            ))}
          </Card>
        </section>
      )}

      {active.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Your active placements
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {active.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/placements/agreements/${a.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <p className="font-bold text-slate-950">
                  {a.placement?.title ?? "Placement"}
                </p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  Active
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-black text-slate-950">
          Open placements
        </h2>
        {!open.length ? (
          <EmptyState
            title="No open placements"
            description="Check back soon — organisations post experience placements here."
          />
        ) : (
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {open.map((p) => (
              <div key={p.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-950">{p.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.weekly_hours}h/week · {p.duration_weeks} weeks
                      {p.is_remote
                        ? " · Remote"
                        : p.location
                          ? ` · ${p.location}`
                          : ""}
                    </p>
                  </div>
                  {appliedIds.has(p.id) ? (
                    <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                      Applied
                    </span>
                  ) : (
                    <ApplyButton placementId={p.id} />
                  )}
                </div>
                <p className="whitespace-pre-wrap text-sm text-slate-600">
                  {p.summary}
                </p>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-bold uppercase text-slate-400">
                      You contribute
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">
                      {p.contribution}
                    </p>
                  </div>
                  <div className="rounded-xl bg-blue-50 p-3">
                    <p className="text-xs font-bold uppercase text-blue-400">
                      You receive
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-slate-700">
                      {p.reward}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
