import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Props = {
  source?: string;
  fallbackHref: string;
  fallbackLabel: string;
};

export default function DashboardBackLink({
  source,
  fallbackHref,
  fallbackLabel,
}: Props) {
  const isFromActionCentre = source === "action-centre";
  const href = isFromActionCentre ? "/dashboard/action-centre" : fallbackHref;
  const label = isFromActionCentre ? "Back to Action Centre" : fallbackLabel;

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-blue-700"
    >
      <ChevronLeft size={16} />
      {label}
    </Link>
  );
}
