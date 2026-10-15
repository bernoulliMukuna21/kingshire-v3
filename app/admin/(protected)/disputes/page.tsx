import Link from "next/link";
import { getAdminQueues } from "@/lib/admin/queues";
import AdminTabs from "@/components/admin/AdminTabs";
import { AdminQueueWarning } from "@/components/admin/AdminTasks";
import DisputeActions from "./DisputeActions";
import RoleDisputeActions from "../role-disputes/RoleDisputeActions";
import PlacementDisputeActions from "../placement-disputes/AdminDisputeActions";
import { adminMoney } from "@/components/admin/AdminMoney";
import { coerceNumericList } from "@/lib/db/coerce";
export default async function AdminDisputes({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const queues = await getAdminQueues();
  const { type = "all" } = await searchParams;
  const selected = ["jobs", "roles", "placements"].includes(type)
    ? type
    : "all";
  const jobDisputes =
    selected === "all" || selected === "jobs" ? queues.disputes : [];
  const periods = coerceNumericList(
    queues.periods.filter((row) => row.status === "disputed"),
    ["worker_amount"],
  ).filter(
    (row) =>
      selected === "all" ||
      (queues.engagementById.get(row.engagement_id)?.source_kind === "org_role"
        ? selected === "roles"
        : selected === "placements"),
  );
  const paymentsByJob = new Map(
    coerceNumericList(queues.payments, ["amount"]).map((row) => [
      row.job_id,
      row,
    ]),
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Disputes</h1>
          <p className="mt-2 text-sm text-slate-500">
            Open cases across jobs, organisation roles and placements.
          </p>
        </div>
        <Link
          href="/admin/action-centre?category=disputes"
          className="text-sm font-semibold text-blue-700"
        >
          Action centre →
        </Link>
      </div>
      <Link
        href="/admin/disputes/history"
        className="inline-block text-sm text-blue-700"
      >
        One-off case history →
      </Link>
      <AdminQueueWarning unavailable={queues.unavailable} />
      <AdminTabs
        selected={selected}
        tabs={[
          { label: "All cases", value: "all" },
          { label: "Jobs", value: "jobs" },
          { label: "Role payments", value: "roles" },
          { label: "Placement payments", value: "placements" },
        ].map((tab) => ({ ...tab, href: `/admin/disputes?type=${tab.value}` }))}
      />
      {!jobDisputes.length && !periods.length && (
        <p className="rounded-xl bg-white p-6 text-sm text-slate-500">
          {queues.unavailable.length
            ? "Cases may be unavailable. Check the queue warning."
            : "No open cases match this filter."}
        </p>
      )}
      {jobDisputes.map((row) => {
        const payment = paymentsByJob.get(row.job_id);
        return (
          <section
            id={row.id}
            key={row.id}
            className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5"
          >
            <p className="text-xs text-slate-500">Job dispute</p>
            <h2 className="mt-2 font-bold">
              {queues.jobById.get(row.job_id)?.title ?? "Job"}
            </h2>
            <p className="my-3 whitespace-pre-wrap text-sm text-slate-600">
              {row.reason}
            </p>
            <Link
              href={`/jobs/${row.job_id}`}
              className="text-sm text-blue-700"
            >
              View job context →
            </Link>
            <div className="mt-4">
              {payment &&
              !payment.release_attempt_id &&
              !payment.stripe_transfer_id &&
              !payment.manual_payout_reference ? (
                <DisputeActions disputeId={row.id} jobBudget={payment.amount} />
              ) : (
                <Link
                  href="/admin/finance?tab=issues"
                  className="text-sm text-amber-800"
                >
                  Verify payment status before resolving this case →
                </Link>
              )}
            </div>
          </section>
        );
      })}
      {periods.map((row) => {
        const engagement = queues.engagementById.get(row.engagement_id);
        const role = engagement?.source_kind === "org_role";
        return (
          <section
            id={row.id}
            key={row.id}
            className="scroll-mt-6 rounded-2xl border border-slate-100 bg-white p-5"
          >
            <p className="text-xs text-slate-500">
              {role ? "Role" : "Placement"} payment dispute · Period{" "}
              {row.period_index}
            </p>
            <h2 className="mt-2 font-bold">
              {role
                ? (queues.jobById.get(engagement!.source_id)?.title ??
                  "Organisation role")
                : "Placement payment"}{" "}
              · {adminMoney(row.worker_amount)}
            </h2>
            <p className="my-3 whitespace-pre-wrap text-sm text-slate-600">
              {row.dispute_reason ?? "No reason recorded."}
            </p>
            {engagement && (
              <Link
                href={
                  role
                    ? `/jobs/${engagement.source_id}`
                    : `/dashboard/placements/agreements/${engagement.source_id}`
                }
                className="text-sm text-blue-700"
              >
                View work context →
              </Link>
            )}
            <div className="mt-4">
              {row.release_attempt_id ? (
                <Link
                  href={`/admin/settlements#${row.id}`}
                  className="text-sm text-amber-800"
                >
                  Reconcile the existing settlement first →
                </Link>
              ) : engagement ? (
                role ? (
                  <RoleDisputeActions paymentId={row.id} />
                ) : (
                  <PlacementDisputeActions paymentId={row.id} />
                )
              ) : (
                <p className="text-sm text-amber-800">
                  Work context unavailable. Resolution is disabled.
                </p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
