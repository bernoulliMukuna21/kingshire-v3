import { getDashboardContext } from "@/lib/dashboard-context";
import { ActionCentreSummaryCard } from "@/components/dashboard/ActionCentre";
import { getAccountActionCentre } from "@/lib/action-centre";
import { LoadingBlock } from "@/components/ui/LoadingSkeleton";

export async function ClientActionCentreSection() {
  const { supabase, user, organisations } = await getDashboardContext();

  const { actionCount, waitingCount } = await getAccountActionCentre({
    supabase,
    userId: user.id,
    role: "client",
    organisations,
  });

  return (
    <div>
      <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
        Action Centre
      </h2>
      <ActionCentreSummaryCard
        actionCount={actionCount}
        waitingCount={waitingCount}
        waitingOnLabel="the Kinglancer"
        actionDescription="Review approvals, applicants, requested changes, and escrow payments from one structured page."
      />
    </div>
  );
}

export function ActionCentreSkeleton() {
  return (
    <div>
      <LoadingBlock className="mb-3 h-3 w-28" />
      <LoadingBlock className="h-24 rounded-[1.75rem]" />
    </div>
  );
}
