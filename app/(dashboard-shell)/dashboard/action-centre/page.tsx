import { CheckCircle2 } from "lucide-react";
import { getDashboardContext } from "@/lib/dashboard-context";
import { getActionCentre, type ActionCentreRole } from "@/lib/action-centre";
import EmptyState from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import {
  ActionCentreHeader,
  ActionItemsView,
  ActionSummary,
} from "@/components/dashboard/ActionCentre";

export default async function ActionCentrePage() {
  const { supabase, user, profile } = await getDashboardContext();

  const role: ActionCentreRole =
    profile.role === "client" ? "client" : "kinglancer";
  const { items, actionCount, waitingCount } = await getActionCentre({
    supabase,
    userId: user.id,
    role,
  });

  const roleLabel = role === "client" ? "Client" : "Kinglancer";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <ActionCentreHeader roleLabel={roleLabel} actionCount={actionCount} />
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
