"use client";
import { useRouter } from "next/navigation";
export type Workspace = { id: string; name: string; role: "owner" | "admin" | "member" };
export default function WorkspaceSwitcher({ organisations, currentId, personalHref }: { organisations: Workspace[]; currentId?: string; personalHref: string }) {
  const router = useRouter();
  return <label className="block px-4 py-3 text-xs font-semibold text-white/70">Workspace
    <select aria-label="Switch workspace" value={currentId ?? "personal"} onChange={(e) => router.push(e.target.value === "personal" ? personalHref : `/dashboard/organisations/${e.target.value}`)} className="mt-2 w-full rounded-xl border border-white/20 bg-[#10234b] px-3 py-2.5 text-sm text-white">
      <option value="personal">Personal workspace</option>
      {organisations.map(org => <option key={org.id} value={org.id}>{org.name} · {org.role}</option>)}
    </select>
  </label>;
}
