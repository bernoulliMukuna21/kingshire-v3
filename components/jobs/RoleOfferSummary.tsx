import { deriveRoleOfferView, rolePayLabel } from "@/lib/role-offer-view";
import Link from "next/link";
import { ArrowRight, CalendarDays, UserRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";

type RoleOfferSummaryProps = {
  jobId: string;
  organisationId: string;
  engagement: {
    status: string;
    amount_per_period: number | string | null;
    cadence: string;
    settlement_mode: string;
    org_signed_at: string | null;
  };
  recipientName: string;
};

export default function RoleOfferSummary({
  jobId,
  organisationId,
  engagement,
  recipientName,
}: RoleOfferSummaryProps) {
  const view = deriveRoleOfferView(engagement.status);
  const href = `/dashboard/organisations/${organisationId}/jobs/${jobId}/offer`;

  return (
    <Card className="border-emerald-100 bg-emerald-50/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <StatusBadge className="bg-white text-emerald-700 ring-emerald-100">
            {view.label}
          </StatusBadge>
          <h2 className="mt-3 text-xl font-black text-slate-950">
            {view.recipientLabel} {recipientName}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-emerald-900">
            <span className="inline-flex items-center gap-1.5">
              <UserRound size={14} />
              {rolePayLabel(engagement.amount_per_period, engagement.cadence)}
            </span>
            {engagement.org_signed_at && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                Sent{" "}
                {new Date(engagement.org_signed_at).toLocaleDateString("en-GB")}
              </span>
            )}
          </div>
        </div>
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-sm ring-1 ring-emerald-100 hover:bg-emerald-50"
        >
          View {view.title.toLowerCase()} <ArrowRight size={16} />
        </Link>
      </div>
    </Card>
  );
}
