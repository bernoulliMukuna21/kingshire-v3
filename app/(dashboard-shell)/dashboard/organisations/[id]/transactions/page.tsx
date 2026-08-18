import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrganisationMembership } from "@/lib/organisations";
import { getOrganisationTransactions } from "@/infrastructure/supabase/queries/organisation-queries";
import { Card } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import OrganisationWorkspaceHeader from "../OrganisationWorkspaceHeader";

export default async function OrganisationTransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const result = await getOrganisationTransactions(id, page);
  if (!result) notFound();
  return (
    <div className="mx-auto max-w-5xl space-y-7 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={result.organisationName}
        role={membership.role}
        subtitle="Payments for jobs owned by this Organisation."
        active="transactions"
        canManageMembers={membership.role === "owner" || membership.role === "admin"}
      />
      {!result.transactions.length ? (
        <EmptyState title="No transactions yet" description="Payments appear here after the Organisation selects and pays a Kinglancer." />
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {result.transactions.map((transaction) => {
            const total = transaction.amount + transaction.platformFeeClient;
            return (
              <div key={transaction.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div>
                  <Link href={`/dashboard/client/jobs/${transaction.jobId}`} className="font-bold text-slate-950 hover:text-blue-700">{transaction.jobTitle}</Link>
                  <p className="mt-1 text-xs text-slate-500">{transaction.kinglancerName} · {new Date(transaction.createdAt).toLocaleDateString("en-GB")}</p>
                </div>
                <div className="text-right">
                  <p className="font-black">£{total.toFixed(2)}</p>
                  <StatusBadge className="mt-1 capitalize">{transaction.status}</StatusBadge>
                </div>
              </div>
            );
          })}
          <Pagination
            basePath={`/dashboard/organisations/${id}/transactions`}
            page={result.page}
            total={result.total}
            pageSize={result.pageSize}
            itemLabel="transactions"
          />
        </Card>
      )}
    </div>
  );
}
