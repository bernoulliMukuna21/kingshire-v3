import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import DashboardShell from "@/components/DashboardShell";
import { getNavItems } from "@/lib/dashboard-nav";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Awaiting payment", color: "bg-gray-100 text-gray-600" },
  held: { label: "In escrow", color: "bg-blue-50 text-blue-700" },
  released: { label: "Released", color: "bg-green-50 text-green-700" },
  refunded: { label: "Refunded", color: "bg-orange-50 text-orange-700" },
  disputed: { label: "Disputed", color: "bg-red-50 text-red-700" },
};

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [profileResult, txResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", user.id)
      .single(),

    supabase
      .from("transactions")
      .select(
        "id, amount, platform_fee_client, status, created_at, released_at, job_id, job:jobs!job_id(title), kinglancer:profiles!kinglancer_id(full_name)",
      )
      .eq("client_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");

  type TxRow = {
    id: string;
    amount: number;
    platform_fee_client: number;
    status: string;
    created_at: string;
    released_at: string | null;
    job_id: string;
    job: { title: string } | null;
    kinglancer: { full_name: string } | null;
  };

  const transactions = (txResult.data ?? []) as TxRow[];

  const totalSpent = transactions
    .filter((t) => t.status === "released")
    .reduce((sum, t) => sum + t.amount + t.platform_fee_client, 0);

  const totalHeld = transactions
    .filter((t) => t.status === "held")
    .reduce((sum, t) => sum + t.amount + t.platform_fee_client, 0);

  const navItems = getNavItems("client", "/dashboard/client/transactions");

  return (
    <DashboardShell profile={profile} navItems={navItems}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <FadeIn className="mb-8">
          <h1 className="text-2xl font-black text-gray-900">
            Transaction History
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            All payments made through KingsHire.
          </p>
        </FadeIn>

        {/* Summary cards */}
        <Stagger className="grid grid-cols-2 gap-4 mb-8" staggerDelay={0.07}>
          <StaggerItem>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Total Spent
              </p>
              <p className="text-3xl font-black text-gray-900">
                £{totalSpent.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Across{" "}
                {transactions.filter((t) => t.status === "released").length}{" "}
                released payment
                {transactions.filter((t) => t.status === "released").length !==
                1
                  ? "s"
                  : ""}
              </p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Held in Escrow
              </p>
              <p className="text-3xl font-black text-gray-900">
                £{totalHeld.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Funds reserved for active jobs
              </p>
            </div>
          </StaggerItem>
        </Stagger>

        {/* Transactions list */}
        <FadeIn className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-sm">No transactions yet.</p>
              <p className="text-gray-400 text-xs mt-1">
                Payments will appear here once you hire a Kinglancer.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                <span>Job / Kinglancer</span>
                <span className="text-right">Amount</span>
                <span className="text-right hidden sm:block">Fee</span>
                <span className="text-right">Status</span>
              </div>

              {transactions.map((tx) => {
                const s = STATUS_CONFIG[tx.status] ?? STATUS_CONFIG.pending;
                const total = tx.amount + tx.platform_fee_client;
                const date = new Date(tx.created_at).toLocaleDateString(
                  "en-GB",
                  { day: "numeric", month: "short", year: "numeric" },
                );
                return (
                  <div
                    key={tx.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 items-center"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/jobs/${tx.job_id}`}
                        className="font-semibold text-gray-900 hover:text-blue-700 transition-colors text-sm inline-flex items-center gap-1 group"
                      >
                        {tx.job?.title ?? "Deleted job"}
                        <ArrowUpRight
                          size={13}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {tx.kinglancer?.full_name ?? "—"} · {date}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">
                        £{total.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">total</p>
                    </div>

                    <div className="text-right hidden sm:block">
                      <p className="text-sm text-gray-500">
                        £{tx.platform_fee_client.toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400">platform</p>
                    </div>

                    <div>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${s.color}`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FadeIn>
      </div>
    </DashboardShell>
  );
}
