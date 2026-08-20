import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getOrganisationMembership,
  requireOrganisationPermission,
} from "@/lib/organisations";
import { getOrganisationName } from "@/infrastructure/supabase/queries/organisation-queries";
import { getOrganisationPlacement } from "@/lib/db/placements";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import { Card } from "@/components/ui/Card";
import OrganisationWorkspaceHeader from "../../OrganisationWorkspaceHeader";
import PlacementForm, { type PlacementFormInitial } from "./PlacementForm";

export default async function NewPlacementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");
  if (!(await requireOrganisationPermission(id, user.id, "manage_jobs"))) {
    notFound();
  }
  const membership = await getOrganisationMembership(id, user.id);
  if (!membership) notFound();
  const organisationName = await getOrganisationName(id);
  if (!organisationName) notFound();

  let initial: PlacementFormInitial | undefined;
  if (from) {
    const source = await getOrganisationPlacement(from, id);
    if (source) {
      const details = (source.compensation_details ?? {}) as Record<
        string,
        unknown
      >;
      const money = (details.money ?? null) as {
        amount?: number;
        cadence?: string;
      } | null;
      const compDetails: Record<string, string> = {};
      for (const type of source.compensation_types ?? []) {
        if (type === "money") continue;
        compDetails[type] = String(details[type] ?? "");
      }
      const workMode = (["remote", "hybrid", "onsite"].includes(
        source.work_mode,
      )
        ? source.work_mode
        : "remote") as PlacementFormInitial["workMode"];
      initial = {
        title: source.title,
        summary: source.summary ?? "",
        categories: source.categories ?? [],
        contribution: source.contribution,
        workMode,
        daysOnSite: String(source.days_on_site ?? 2),
        location: source.location ?? "",
        compensation: source.compensation_types ?? [],
        moneyAmount: money?.amount ? String(money.amount) : "",
        moneyCadence: money?.cadence ?? "per_month",
        compDetails,
        weeklyHours: String(source.weekly_hours ?? 8),
        paymentMode: source.payment_mode === "managed" ? "managed" : "direct",
      };
    }
  }
  const isRepost = !!initial;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <OrganisationWorkspaceHeader
        organisationId={id}
        organisationName={organisationName}
        role={membership.role}
        active="placements"
        canManageMembers={
          membership.role === "owner" || membership.role === "admin"
        }
      />
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <div>
          <Link
            href={`/dashboard/organisations/${id}/placements`}
            className="text-sm font-bold text-blue-700 hover:text-blue-800"
          >
            ← Back to placements
          </Link>
          <h1 className="mt-2 text-2xl font-black text-slate-950">
            {isRepost ? "Repost placement" : "Create a placement"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isRepost
              ? "We've prefilled the details from the previous placement. Set new dates, review, and post."
              : "A supervised experience placement. Be clear about what the participant contributes and what they receive."}
          </p>
        </div>
        <Card className="p-6">
          <PlacementForm
            organisationId={id}
            categories={JOB_CATEGORIES as unknown as string[]}
            initial={initial}
          />
        </Card>
      </div>
    </div>
  );
}
