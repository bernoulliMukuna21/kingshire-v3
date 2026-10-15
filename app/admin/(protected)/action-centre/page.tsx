import Link from "next/link";
import { getAdminQueues } from "@/lib/admin/queues";
import { selectAdminActions } from "@/lib/admin/action-view";
import AdminTasks, { AdminQueueWarning } from "@/components/admin/AdminTasks";
import AdminTabs from "@/components/admin/AdminTabs";
export default async function AdminActionCentre({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; kind?: string }>;
}) {
  const { category = "all", kind = "action" } = await searchParams;
  const queues = await getAdminQueues();
  const selectedKind = ["action", "waiting", "all"].includes(kind)
    ? kind
    : "action";
  const selectedCategory = ["payments", "disputes", "reviews"].includes(
    category,
  )
    ? category
    : "all";
  const items = selectAdminActions(
    queues.items,
    selectedCategory,
    selectedKind,
  );
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Action centre</h1>
        <p className="mt-2 text-sm text-slate-500">
          {queues.unavailable.length
            ? "Some queues need refreshing."
            : `${queues.actionCount} need attention · ${queues.waitingCount} waiting on others`}
        </p>
      </div>
      <AdminQueueWarning unavailable={queues.unavailable} />
      <AdminTabs
        selected={selectedKind}
        tabs={[
          { label: "Needs attention", value: "action" },
          { label: "Waiting", value: "waiting" },
          { label: "All", value: "all" },
        ].map((tab) => ({
          ...tab,
          href: `/admin/action-centre?kind=${tab.value}&category=${selectedCategory}`,
        }))}
      />
      <AdminTabs
        selected={selectedCategory}
        tabs={[
          { label: "Everything", value: "all" },
          { label: "Payments", value: "payments" },
          { label: "Disputes", value: "disputes" },
          { label: "Reviews", value: "reviews" },
        ].map((tab) => ({
          ...tab,
          href: `/admin/action-centre?kind=${selectedKind}&category=${tab.value}`,
        }))}
      />
      <AdminTasks
        items={items}
        empty={
          queues.unavailable.length
            ? "No tasks available from the queues that loaded. Other tasks may be unavailable."
            : "No items match these filters."
        }
      />
      <Link
        href="/admin/disputes"
        className="inline-block text-sm font-semibold text-blue-700"
      >
        Open dispute workspace →
      </Link>
    </div>
  );
}
