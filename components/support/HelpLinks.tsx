"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleHelp, MessageSquare } from "lucide-react";
import { contactHref } from "@/lib/support/view";
export default function HelpLinks({
  compact = false,
  onNavigate,
}: {
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className={compact ? "flex gap-2" : "grid grid-cols-2 gap-2"}>
      <Link
        onClick={onNavigate}
        aria-label="Get help"
        href={contactHref("account", pathname)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
      >
        <CircleHelp size={15} />
        <span className={compact ? "hidden min-[380px]:inline" : undefined}>
          Get help
        </span>
      </Link>
      {!compact && (
        <Link
          onClick={onNavigate}
          href={contactHref("feedback", pathname)}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white hover:bg-white/20"
        >
          <MessageSquare size={15} />
          Feedback
        </Link>
      )}
    </div>
  );
}
