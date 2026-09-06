import Link from "next/link";

export default function BrowseModeTabs({
  active,
}: {
  active: "jobs" | "placements";
}) {
  const tabs = [
    { key: "jobs", label: "Jobs", href: "/jobs" },
    { key: "placements", label: "Placements", href: "/placements" },
  ] as const;

  return (
    <div className="mt-6 inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/15">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-full px-5 py-2 text-sm font-bold transition ${
            active === tab.key
              ? "bg-white text-slate-900"
              : "text-white/80 hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
