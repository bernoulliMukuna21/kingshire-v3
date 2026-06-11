import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";

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
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <FadeIn className="mb-8">
        <PageHeader
          eyebrow="Payments"
          title="Transaction History"
          description="All payments made through KingsHire, including escrow and released payments."
        />
      </FadeIn>

      {/* Summary cards */}
      <Stagger className="grid grid-cols-2 gap-4 mb-8" staggerDelay={0.07}>
        <StaggerItem>
          <Card className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Total Spent
            </p>
            <p className="text-3xl font-black text-slate-950">
              £{totalSpent.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Across{" "}
              {transactions.filter((t) => t.status === "released").length}{" "}
              released payment
              {transactions.filter((t) => t.status === "released").length !== 1
                ? "s"
                : ""}
            </p>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Held in Escrow
            </p>
            <p className="text-3xl font-black text-slate-950">
              £{totalHeld.toFixed(2)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Funds reserved for active jobs
            </p>
          </Card>
        </StaggerItem>
      </Stagger>

      {/* Transactions list */}
      <FadeIn className="overflow-hidden rounded-[1.75rem] border border-white bg-white/90 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50">
        {transactions.length === 0 ? (
          <EmptyState
            title="No transactions yet"
            description="Payments will appear here once you hire a Kinglancer."
          />
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
              const date = new Date(tx.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-4 items-center"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/client/jobs/${tx.job_id}`}
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
                    <p className="font-bold text-slate-950 text-sm">
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
                    <StatusBadge className={s.color}>{s.label}</StatusBadge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </FadeIn>
    </div>
  );
}
