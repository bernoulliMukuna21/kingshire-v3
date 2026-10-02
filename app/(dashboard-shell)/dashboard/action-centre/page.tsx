import { notFound } from "next/navigation";
import Link from "next/link";
import { scopeActionCentre } from "@/lib/action-centre/view";
import { CheckCircle2 } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard-context";
import {
  getAccountActionCentre,
  type ActionCentreRole,
} from "@/lib/action-centre";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import {
  ActionCentreHeader,
  ActionItemsView,
  ActionSummary,
} from "@/components/dashboard/ActionCentre";

export default async function ActionCentrePage({ searchParams }: { searchParams: Promise<{ workspace?: string }> }) {
  const { workspace = "all" } = await searchParams;
  const { supabase, user, profile, organisations } =
    await getDashboardContext();

  if (workspace !== "all" && workspace !== "personal" && !organisations.some(org => org.id === workspace)) notFound();

  const role: ActionCentreRole =
    profile.role === "client" ? "client" : "kinglancer";
  const centre = await getAccountActionCentre({
    supabase,
    userId: user.id,
    role,
    organisations,
  });

  const { items, actionCount, waitingCount } = scopeActionCentre(centre.items, workspace);
  const scopes = [{ id: "all", name: "All workspaces" }, { id: "personal", name: "Personal workspace" }, ...organisations];

  const roleLabel = role === "client" ? "Client" : "Kinglancer";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <ActionCentreHeader roleLabel={roleLabel} actionCount={actionCount} />
      <nav aria-label="Action Centre workspace" className="flex flex-wrap gap-2">
        {scopes.map(scope => <Link key={scope.id} href={`/dashboard/action-centre?workspace=${scope.id}`} aria-current={workspace === scope.id ? "page" : undefined} className={`rounded-xl border px-4 py-2 text-sm font-semibold ${workspace === scope.id ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}>{scope.name}</Link>)}
      </nav>
      <ActionSummary actionCount={actionCount} waitingCount={waitingCount} />

      {actionCount === 0 && waitingCount === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title="You are all caught up"
          description="When a job needs a reply, decision, approval, or escrow payment, it will appear here."
          action={
            role === "client" ? (
              <ButtonLink href="/jobs/post" size="sm">
                Post a job
              </ButtonLink>
            ) : (
              <ButtonLink href="/jobs" size="sm">
                Browse jobs
              </ButtonLink>
            )
          }
        />
      ) : (
        <ActionItemsView items={items} />
      )}
    </div>
  );
}
