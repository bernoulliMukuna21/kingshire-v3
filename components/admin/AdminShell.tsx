"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import SignOutButton from "@/components/SignOutButton";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

import {
  LayoutDashboard,
  Inbox,
  Wallet,
  Users,
  Briefcase,
  ClipboardCheck,
  Menu,
} from "lucide-react";
import { useState } from "react";
import { adminNavigation, adminSection } from "@/lib/admin/navigation";
const icons = {
  overview: LayoutDashboard,
  actions: Inbox,
  finance: Wallet,
  people: Users,
  work: Briefcase,
  reviews: ClipboardCheck,
};
const ADMIN_NAV_ITEMS = adminNavigation;

type Props = {
  userEmail?: string | null;
  children: ReactNode;
  actionCount?: number | null;
  actionBadge?: ReactNode;
};

export default function AdminShell({
  userEmail,
  children,
  actionCount,
  actionBadge,
}: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff_0,#f8fafc_34%,#f1f5f9_100%)] text-slate-900">
      <div className="fixed bottom-0 left-0 top-0 z-40 hidden w-72 flex-col bg-[#10234b] shadow-2xl shadow-slate-950/20 lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.26),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)]" />

        <div className="relative border-b border-white/10 p-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={137}
              height={36}
              className="h-9 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <span className="mt-4 inline-block rounded-full bg-red-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-200 ring-1 ring-red-300/20">
            Admin
          </span>
        </div>

        <nav className="relative flex-1 space-y-1.5 p-4">
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = adminSection(pathname) === item.href;
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all",
                  active
                    ? "bg-white text-[#10234b] shadow-lg shadow-slate-950/15"
                    : "text-white/55 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon size={19} aria-hidden="true" />
                {item.label}
                {item.icon === "actions" && (
                  <span className="ml-auto rounded-full bg-slate-200/20 px-2 py-0.5 text-xs">
                    {actionBadge ?? actionCount ?? "—"}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="relative space-y-3 border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <Avatar name={userEmail} tone="red" className="h-10 w-10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {userEmail}
              </p>
              <p className="text-xs text-white/40">Admin</p>
            </div>
          </div>
          <SignOutButton className="w-full" />
        </div>
      </div>

      <div className="sticky top-0 z-40 bg-[#10234b]/95 shadow-xl shadow-slate-950/15 backdrop-blur-md lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={122}
              height={32}
              className="h-8 w-auto brightness-0 invert"
              priority
            />
          </Link>
          <button
            aria-label="Toggle admin navigation"
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-navigation"
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-lg p-2 text-white"
          >
            <Menu size={22} />
          </button>
        </div>
        <div
          id="admin-mobile-navigation"
          className={`${menuOpen ? "grid" : "hidden"} grid-cols-2 gap-2 border-t border-white/10 p-4`}
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = adminSection(pathname) === item.href;
            const Icon = icons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold",
                  active
                    ? "bg-white text-[#10234b]"
                    : "bg-white/10 text-white/70",
                )}
              >
                <Icon size={15} className="mr-2 inline" />
                {item.label}
                {item.icon === "actions" && (
                  <span className="ml-2">
                    ({actionBadge ?? actionCount ?? "—"})
                  </span>
                )}
              </Link>
            );
          })}
          <div className="col-span-2 pt-2">
            <SignOutButton className="w-full" />
          </div>
        </div>
      </div>

      <div className="lg:pl-72">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
