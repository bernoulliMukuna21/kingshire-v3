"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import SignOutButton from "@/components/SignOutButton";
import { ButtonLink } from "@/components/ui/Button";

const navLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Browse Jobs", href: "/jobs" },
  { label: "Kinglancers", href: "/kinglancers" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [dashboardHref, setDashboardHref] = useState("/dashboard/client");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      // getSession reads from local storage — no network call — gives us the user ID
      // immediately so we can fire getUser (server validation) + profile fetch in parallel.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const [{ data: authData }, { data: profile }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("full_name, role")
            .eq("id", session.user.id)
            .single(),
        ]);

        if (authData.user) {
          setIsLoggedIn(true);
          if (profile?.full_name) setFirstName(profile.full_name.split(" ")[0]);
          if (profile?.role)
            setDashboardHref(
              profile.role === "kinglancer"
                ? "/dashboard/kinglancer"
                : "/dashboard/client",
            );
        }
      }
      setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
      if (!session?.user) {
        setFirstName("");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={137}
            height={36}
            className={`h-9 w-auto transition-opacity ${scrolled ? "opacity-100" : "brightness-0 invert opacity-90"}`}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-blue-400 ${
                scrolled ? "text-gray-600" : "text-white/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-3">
          {authReady &&
            (isLoggedIn ? (
              <>
                <ButtonLink
                  href={dashboardHref}
                  size="sm"
                >
                  {firstName ? `Hi, ${firstName}` : "Dashboard"}
                </ButtonLink>
                <SignOutButton
                  onSignOut={() => {
                    setIsLoggedIn(false);
                    setFirstName("");
                  }}
                />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={`text-sm font-medium px-4 py-2 rounded-lg transition-colors ${
                    scrolled
                      ? "text-gray-700 hover:text-blue-600"
                      : "text-white/90 hover:text-white"
                  }`}
                >
                  Sign in
                </Link>
                <ButtonLink
                  href="/sign-up"
                  size="sm"
                >
                  Get started
                </ButtonLink>
              </>
            ))}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={`md:hidden p-2 rounded-lg transition-colors ${scrolled ? "text-gray-700" : "text-white"}`}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100 px-6 pb-4"
          >
            <nav className="flex flex-col gap-1 pt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="text-gray-700 font-medium py-2 text-sm hover:text-blue-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 mt-2">
                {authReady &&
                  (isLoggedIn ? (
                    <>
                      <ButtonLink
                        href={dashboardHref}
                        onClick={() => setMenuOpen(false)}
                        size="sm"
                        className="w-full"
                      >
                        {firstName ? `Hi, ${firstName}` : "Dashboard"}
                      </ButtonLink>
                      <SignOutButton
                        onSignOut={() => {
                          setMenuOpen(false);
                          setIsLoggedIn(false);
                          setFirstName("");
                        }}
                        className="w-full"
                      />
                    </>
                  ) : (
                    <>
                      <Link
                        href="/sign-in"
                        className="w-full text-center text-sm font-medium py-2 border border-gray-200 rounded-lg text-gray-700 hover:border-blue-300 transition-colors"
                      >
                        Sign in
                      </Link>
                      <ButtonLink
                        href="/sign-up"
                        size="sm"
                        className="w-full"
                      >
                        Get started
                      </ButtonLink>
                    </>
                  ))}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
