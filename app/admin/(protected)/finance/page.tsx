import { getAdminFinances } from "@/lib/admin/finances";
import { getAdminDb } from "@/lib/admin/access";
import AdminPaymentHistory from "@/components/admin/AdminPaymentHistory";
import AdminTabs from "@/components/admin/AdminTabs";
import AdminMoney from "@/components/admin/AdminMoney";
import ManualPayments from "@/components/admin/AdminManualWorkflow";
import Settlements from "../settlements/page";
export default async function AdminFinance({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ledger?: string; page?: string }>;
}) {
  await getAdminDb();
  const { tab = "summary", ledger, page } = await searchParams;
  const selected = ["incoming", "payouts", "issues", "history"].includes(tab)
    ? tab
    : "summary";
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black">Finance</h1>
        <p className="mt-2 text-sm text-slate-500">
          Cash, payments and settlement history.
        </p>
      </div>
      <AdminTabs
        selected={selected}
        tabs={[
          { label: "Summary", value: "summary" },
          { label: "Incoming funds", value: "incoming" },
          { label: "Payouts", value: "payouts" },
          { label: "Payment issues", value: "issues" },
          { label: "History", value: "history" },
        ].map((item) => ({
          ...item,
          href: `/admin/finance?tab=${item.value}`,
        }))}
      />
      {selected === "summary" && (
        <AdminMoney finances={await getAdminFinances()} />
      )}
      {(selected === "incoming" || selected === "payouts") && (
        <ManualPayments section={selected} />
      )}
      {selected === "issues" && <Settlements />}
      {selected === "history" && (
        <AdminPaymentHistory ledger={ledger} page={page} />
      )}
    </div>
  );
}
