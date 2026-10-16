export const dynamic = "force-dynamic";
import Link from "next/link";
import { getAdminDb } from "@/lib/admin/access";
import { getAdminQueues } from "@/lib/admin/queues";
import { getAdminFinances } from "@/lib/admin/finances";
import { selectAdminActions } from "@/lib/admin/action-view";
import AdminMoney from "@/components/admin/AdminMoney";
import AdminTasks, { AdminQueueWarning } from "@/components/admin/AdminTasks";
import { jobStatusPill } from "@/lib/jobs";

export default async function AdminDashboard() {
  const db = await getAdminDb();
  const [queues, finances, users, recentUsers] = await Promise.all([
    getAdminQueues(),
    getAdminFinances(),
    db
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or("role.is.null,role.neq.admin"),
    db
      .from("profiles")
      .select("id,full_name,role")
      .or("role.is.null,role.neq.admin")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const attention = selectAdminActions(queues.items).slice(0, 4);
  const recentJobs = [...queues.jobs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Overview</span>
        <span>
          {new Date().toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Europe/London",
          })}
        </span>
      </div>
      <AdminMoney finances={finances} />
      <div className="grid grid-cols-2 gap-5 rounded-2xl border border-slate-100 bg-white p-5 sm:grid-cols-4">
        {[
          {
            label: "Marketplace users",
            value: users.error ? "Unavailable" : (users.count ?? 0),
            href: "/admin/users",
          },
          {
            label: "Active jobs",
            value: queues.unavailable.includes("jobs")
              ? "Unavailable"
              : queues.jobs.filter((job) =>
                  ["open", "in_progress"].includes(job.status),
                ).length,
            href: "/admin/jobs",
          },
          {
            label: "Need attention",
            value: queues.unavailable.length
              ? "Unavailable"
              : queues.actionCount,
            href: "/admin/action-centre",
          },
          {
            label: "Waiting on others",
            value: queues.unavailable.length
              ? "Unavailable"
              : queues.waitingCount,
            href: "/admin/action-centre?kind=waiting",
          },
        ].map((metric) => (
          <Link href={metric.href} key={metric.label}>
            <p className="text-2xl font-black tabular-nums">{metric.value}</p>
            <p className="mt-1 text-xs text-slate-500">{metric.label}</p>
          </Link>
        ))}
      </div>
      <AdminQueueWarning unavailable={queues.unavailable} />
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Needs attention</h2>
          <Link
            href="/admin/action-centre"
            className="text-sm font-semibold text-blue-700"
          >
            View all →
          </Link>
        </div>
        <AdminTasks
          items={attention}
          empty={
            queues.unavailable.length
              ? "No tasks available from the queues that loaded."
              : "Nothing needs your attention right now."
          }
        />
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="mb-3 flex justify-between">
            <h2 className="font-bold">Recent jobs</h2>
            <Link href="/admin/jobs" className="text-xs text-blue-700">
              View all →
            </Link>
          </div>
          {queues.unavailable.includes("jobs") ? (
            <p className="text-sm text-amber-800">Jobs unavailable.</p>
          ) : recentJobs.length ? (
            recentJobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="flex items-center justify-between gap-3 border-t border-slate-100 py-4"
              >
                <span className="text-sm font-semibold">{job.title}</span>
                <span
                  className={`rounded-full px-2 py-1 text-xs ${jobStatusPill(job.status).className}`}
                >
                  {jobStatusPill(job.status).label}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-500">No jobs yet.</p>
          )}
        </section>
        <section className="rounded-2xl border border-slate-100 bg-white p-5">
          <div className="mb-3 flex justify-between">
            <h2 className="font-bold">Recent people</h2>
            <Link href="/admin/users" className="text-xs text-blue-700">
              View all →
            </Link>
          </div>
          {recentUsers.error ? (
            <p className="text-sm text-amber-800">People unavailable.</p>
          ) : recentUsers.data.length ? (
            recentUsers.data.map((person) => (
              <div key={person.id} className="border-t border-slate-100 py-4">
                <p className="text-sm font-semibold">
                  {person.full_name || "Unnamed user"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {person.role ?? "Onboarding"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No users yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
