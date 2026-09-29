import { listDisputedRolePayments } from "@/lib/db/role-payments";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import RoleDisputeActions from "./RoleDisputeActions";

export default async function AdminRoleDisputesPage() {
  const disputes = await listDisputedRolePayments();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-950">
          Organisation role payment disputes
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Held periods an organisation has disputed. Release the escrow to the
          Kinglancer or refund the organisation.
        </p>
      </div>

      {!disputes.length ? (
        <EmptyState
          title="No open disputes"
          description="No Organisation-role payments are under dispute right now."
        />
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <Card key={d.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-lg font-black text-slate-950">
                    {d.jobTitle ?? "Organisation role"} · Period{" "}
                    {d.period_index}
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-slate-600">
                    {d.organisationName ?? "Organisation"} →{" "}
                    {d.kinglancerName ?? "Kinglancer"} · £
                    {Number(d.worker_amount).toFixed(2)}
                  </p>
                </div>
                <RoleDisputeActions paymentId={d.id} />
              </div>

              {d.dispute_reason && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase text-slate-400">
                    Reason
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                    {d.dispute_reason}
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
