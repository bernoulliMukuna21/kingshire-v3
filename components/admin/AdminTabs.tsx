import Link from "next/link";
export default function AdminTabs({
  tabs,
  selected,
}: {
  tabs: { label: string; value: string; href: string }[];
  selected: string;
}) {
  return (
    <nav aria-label="Section navigation" className="mb-6 flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={tab.href}
          aria-current={selected === tab.value ? "page" : undefined}
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${selected === tab.value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
