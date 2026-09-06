"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";
import SignOutButton from "@/components/SignOutButton";
import { getInitials } from "@/lib/utils";
import { getNavItems } from "@/lib/dashboard-nav";
import MobileNav from "@/components/MobileNav";

type Props = {
  profile: {
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
  };
  organisations: Array<{
    id: string;
    name: string;
    role: "owner" | "admin" | "member";
  }>;
  children: React.ReactNode;
};

export default function DashboardShell({ profile, organisations, children }: Props) {
  const pathname = usePathname();
  const navItems = getNavItems(profile.role, pathname);
  const isKinglancer = profile.role === "kinglancer";
  const isAdmin = profile.role === "admin";
  const initials = getInitials(profile.full_name);
  const avatarGradient = isAdmin
    ? "bg-linear-to-br from-red-500 to-orange-600"
    : isKinglancer
      ? "bg-linear-to-br from-green-500 to-emerald-600"
      : "bg-linear-to-br from-blue-500 to-indigo-600";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eef6ff_0,#f8fafc_34%,#f1f5f9_100%)] text-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex fixed top-0 left-0 bottom-0 w-72 bg-[#10234b] flex-col z-40 shadow-2xl shadow-slate-950/20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.35),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.08),transparent_30%)] pointer-events-none" />
        <div className="relative p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
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
            <NotificationBell />
          </div>
          <div className="mt-4">
            {isAdmin ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-red-200 ring-1 ring-red-300/20">
                Admin
              </span>
            ) : isKinglancer ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-200 ring-1 ring-amber-300/20">
                Kinglancer
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-400/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-200 ring-1 ring-blue-300/20">
                Client
              </span>
            )}
          </div>
        </div>

        <nav className="relative flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                item.active
                  ? "bg-white text-[#10234b] shadow-lg shadow-slate-950/15"
                  : "text-white/55 hover:text-white hover:bg-white/10"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="relative p-4 border-t border-white/10 space-y-3">
          {organisations.length > 0 && (
            <div className="rounded-2xl bg-white/5 p-2 ring-1 ring-white/10">
              <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-white/35">
                Switch workspace
              </p>
              <Link
                href={isKinglancer ? "/dashboard/kinglancer" : "/dashboard/client"}
                className="block rounded-xl px-2 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
              >
                Personal workspace
              </Link>
              {organisations.slice(0, 4).map((organisation) => (
                <Link
                  key={organisation.id}
                  href={`/dashboard/organisations/${organisation.id}`}
                  className="block truncate rounded-xl px-2 py-1.5 text-xs font-semibold text-white/65 hover:bg-white/10 hover:text-white"
                >
                  {organisation.name}
                </Link>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/10">
            <div
              className={`w-10 h-10 rounded-2xl ${avatarGradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0 shadow-lg shadow-slate-950/20`}
            >
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {profile.full_name}
              </p>
              <p className="text-white/40 text-xs">
                {isAdmin ? "Admin" : isKinglancer ? "Kinglancer" : "Client"}
              </p>
            </div>
          </div>
          <SignOutButton className="w-full" />
        </div>
      </div>

      {/* Mobile nav (top bar + drawer) */}
      <MobileNav profile={profile} />

      {/* Main content */}
      <div className="lg:pl-72">{children}</div>
    </div>
  );
}
