import { redirect } from "next/navigation";
import Link from "next/link";
import { getDashboardContext } from "@/lib/dashboard-context";
import {
  listKinglancerAgreements,
  listKinglancerApplications,
} from "@/lib/db/placements";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import AgreementActions from "./AgreementActions";

export default async function KinglancerPlacementsPage() {
  const { user, profile } = await getDashboardContext();
  if (profile.role === "client") redirect("/dashboard/client");
  if (profile.role !== "kinglancer") redirect("/onboarding");

  const [applications, agreements] = await Promise.all([
    listKinglancerApplications(user.id),
    listKinglancerAgreements(user.id),
  ]);

  // Hide anything tied to a cancelled placement.
  const live = (status: string | undefined) => status !== "cancelled";
  const offers = agreements.filter(
    (a) => a.status === "pending_acceptance" && live(a.placement?.status),
  );
  const awaitingFunding = agreements.filter(
    (a) => a.status === "pending_funding" && live(a.placement?.status),
  );
  const active = agreements.filter((a) => a.status === "active");
  const completed = agreements.filter((a) => a.status === "completed");
  const applied = applications.filter(
    (a) => a.status === "pending" && live(a.placement?.status),
  );

  const hasNothing =
    !offers.length &&
    !awaitingFunding.length &&
    !active.length &&
    !completed.length &&
    !applied.length;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <PageHeader
        title="Placements"
        description="Supervised experience opportunities with mentoring, training and a verified record."
        action={
          <ButtonLink href="/placements" variant="secondary">
            Browse open placements
          </ButtonLink>
        }
      />

      {offers.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Offers awaiting your response
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {offers.map((a) => (
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

      {awaitingFunding.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Awaiting the organisation
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {awaitingFunding.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/placements/agreements/${a.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <p className="font-bold text-slate-950">
                  {a.placement?.title ?? "Placement"}
                </p>
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                  Awaiting funding
                </span>
              </Link>
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

      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Completed placements
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {completed.map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/placements/agreements/${a.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50"
              >
                <p className="font-bold text-slate-950">
                  {a.placement?.title ?? "Placement"}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                  Completed
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {applied.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-black text-slate-950">
            Your applications
          </h2>
          <Card className="divide-y divide-slate-100 overflow-hidden">
            {applied.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <p className="font-bold text-slate-950">
                  {a.placement?.title ?? "Placement"}
                </p>
                <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                  Applied
                </span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {hasNothing && (
        <EmptyState
          title="No placements yet"
          description="Browse open placements and apply to start building your experience record."
          action={
            <ButtonLink href="/placements">Browse open placements</ButtonLink>
          }
        />
      )}
    </div>
  );
}
