import Link from "next/link";
import type { ReactNode } from "react";

type PublicityTone = "celebration" | "success" | "information";

const toneClasses: Record<PublicityTone, string> = {
  celebration:
    "border-fuchsia-300/20 bg-linear-to-r from-violet-700 via-purple-600 to-fuchsia-600",
  success:
    "border-emerald-300/20 bg-linear-to-r from-emerald-700 to-green-600",
  information:
    "border-blue-300/20 bg-linear-to-r from-blue-700 to-cyan-600",
};

const ctaToneClasses: Record<PublicityTone, string> = {
  celebration: "text-purple-700 hover:bg-purple-50",
  success: "text-emerald-700 hover:bg-emerald-50",
  information: "text-blue-700 hover:bg-blue-50",
};

type PublicityBannerProps = {
  title: string;
  message: string;
  ctaLabel: string;
  ctaHref: string;
  icon?: ReactNode;
  tone?: PublicityTone;
};

export default function PublicityBanner({
  title,
  message,
  ctaLabel,
  ctaHref,
  icon,
  tone = "information",
}: PublicityBannerProps) {
  return (
    <aside
      aria-label={title}
      className={`relative z-20 border-b text-white ${toneClasses[tone]}`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        {icon && (
          <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 sm:flex">
            {icon}
          </span>
        )}
        <p className="min-w-0 flex-1">
          <strong>{title}</strong>{" "}
          <span className="text-white/80">{message}</span>
        </p>
        <Link
          href={ctaHref}
          className={`shrink-0 rounded-full bg-white px-3 py-1.5 font-bold transition ${ctaToneClasses[tone]}`}
        >
          {ctaLabel}
        </Link>
      </div>
    </aside>
  );
}
