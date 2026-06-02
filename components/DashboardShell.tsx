import Link from "next/link";
import Image from "next/image";
import NotificationBell from "@/components/NotificationBell";
import SignOutButton from "@/components/SignOutButton";
import { getInitials } from "@/lib/utils";
import type { DashboardNavItem } from "@/lib/dashboard-nav";

type Props = {
  profile: {
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
  };
  navItems: DashboardNavItem[];
  children: React.ReactNode;
};

export default function DashboardShell({ profile, navItems, children }: Props) {
  const isKinglancer = profile.role === "kinglancer";
  const initials = getInitials(profile.full_name);
  const avatarGradient = isKinglancer
    ? "bg-linear-to-br from-green-500 to-emerald-600"
    : "bg-linear-to-br from-blue-500 to-indigo-600";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex fixed top-0 left-0 bottom-0 w-64 bg-[#0f172a] flex-col z-40">
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="KingsHire"
                width={120}
                height={36}
                className="h-8 w-auto brightness-0 invert"
                priority
              />
            </Link>
            <NotificationBell />
          </div>
          <div className="mt-3">
            {isKinglancer ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[11px] font-semibold tracking-wide uppercase">
                Kinglancer
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-600/20 text-blue-400 text-[11px] font-semibold tracking-wide uppercase">
                Client
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                item.active
                  ? "bg-blue-600 text-white"
                  : "text-white/50 hover:text-white hover:bg-white/5"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5">
            <div
              className={`w-8 h-8 rounded-full ${avatarGradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0`}
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
                {isKinglancer ? "Kinglancer" : "Client"}
              </p>
            </div>
          </div>
          <SignOutButton />
        </div>
      </div>

      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#0f172a] sticky top-0 z-40">
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={110}
            height={32}
            className="h-7 w-auto brightness-0 invert"
            priority
          />
        </Link>
        <SignOutButton />
      </div>

      {/* Main */}
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}
