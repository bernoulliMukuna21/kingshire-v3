"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import SignOutButton from "@/components/SignOutButton";
import { getNavItems } from "@/lib/dashboard-nav";
import { getInitials } from "@/lib/utils";

type Props = {
  profile: {
    full_name: string | null;
    role: string | null;
    avatar_url: string | null;
  };
};

export default function MobileNav({ profile }: Props) {
  const pathname = usePathname();
  const navItems = getNavItems(profile.role, pathname);
  const [open, setOpen] = useState(false);

  const isKinglancer = profile.role === "kinglancer";
  const isAdmin = profile.role === "admin";
  const initials = getInitials(profile.full_name);

  const avatarGradient = isAdmin
    ? "from-red-500 to-orange-600"
    : isKinglancer
      ? "from-green-500 to-emerald-600"
      : "from-blue-500 to-indigo-600";

  const roleLabel = isAdmin ? "Admin" : isKinglancer ? "Kinglancer" : "Client";
  const roleBadgeColor = isAdmin
    ? "bg-red-400/20 text-red-300 ring-red-400/25"
    : isKinglancer
      ? "bg-amber-400/20 text-amber-300 ring-amber-400/25"
      : "bg-blue-400/20 text-blue-300 ring-blue-400/25";

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* ── Top bar ── */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-[#10234b]/95 px-4 py-3 shadow-xl shadow-slate-950/15 backdrop-blur-md">
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

        <div className="flex items-center gap-3">
          <NotificationBell />

          {/* Avatar / drawer trigger */}
          <button
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            className="flex items-center gap-2 rounded-xl bg-white/8 px-2.5 py-1.5 ring-1 ring-white/10 transition hover:bg-white/12 active:scale-95"
          >
            <div
              className={`w-7 h-7 rounded-lg bg-linear-to-br ${avatarGradient} flex items-center justify-center text-white text-xs font-bold overflow-hidden shrink-0`}
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
            {/* Hamburger lines */}
            <div className="flex flex-col gap-1.25">
              <span className="block h-0.5 w-4 rounded-full bg-white/70" />
              <span className="block h-0.5 w-3 rounded-full bg-white/70" />
              <span className="block h-0.5 w-4 rounded-full bg-white/70" />
            </div>
          </button>
        </div>
      </header>

      {/* ── Drawer + overlay ── */}
      <AnimatePresence>
        {open && (
          <>
            {/* Overlay */}
            <motion.div
              key="overlay"
              className="lg:hidden fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              aria-hidden="true"
            />

            {/* Drawer panel */}
            <motion.aside
              key="drawer"
              className="lg:hidden fixed right-0 top-0 bottom-0 z-50 flex w-72 flex-col bg-[#10234b] shadow-2xl shadow-slate-950/40"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 32 }}
            >
              {/* Subtle gradient overlay */}
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_50%)]" />

              {/* Header */}
              <div className="relative flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-linear-to-br ${avatarGradient} flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0 shadow-lg`}
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
                    <p className="text-sm font-semibold text-white truncate">
                      {profile.full_name ?? "User"}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${roleBadgeColor}`}
                    >
                      {roleLabel}
                    </span>
                  </div>
                </div>

                <button
                  onClick={close}
                  aria-label="Close navigation menu"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-white/50 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Nav items */}
              <nav className="relative flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item, i) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, x: 18 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.04, duration: 0.22 }}
                  >
                    <Link
                      href={item.href}
                      onClick={close}
                      className={`flex items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                        item.active
                          ? "bg-white text-[#10234b] shadow-lg shadow-slate-950/15"
                          : "text-white/60 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-lg leading-none">{item.icon}</span>
                      {item.label}
                    </Link>
                  </motion.div>
                ))}
              </nav>

              {/* Footer */}
              <div
                className="relative border-t border-white/10 p-4"
                style={{
                  paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                }}
              >
                <SignOutButton className="w-full" />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
