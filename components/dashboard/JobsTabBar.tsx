import Link from "next/link";

type Props = {
  tabs: string[];
  labels: Record<string, string>;
  counts: Record<string, number>;
  activeTab: string;
  basePath: string;
  /**
   * The tab whose count badge is highlighted blue when it is the active tab.
   * Defaults to "active" — matches the "Active" tab present on both
   * client and kinglancer job views.
   */
  accentTab?: string;
};

/**
 * Generic tab navigation strip shared across client and kinglancer job pages.
 * Purely presentational — all data is passed via props.
 */
export default function JobsTabBar({
  tabs,
  labels,
  counts,
  activeTab,
  basePath,
  accentTab = "active",
}: Props) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1">
      {tabs.map((t) => {
        const isActive = t === activeTab;
        return (
          <Link
            key={t}
            href={`${basePath}?tab=${t}`}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-all ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {labels[t]}
            {counts[t] > 0 && (
              <span
                className={`rounded-full px-1.5 py-0.5 text-xs font-black tabular-nums ${
                  isActive
                    ? t === accentTab
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {counts[t]}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
