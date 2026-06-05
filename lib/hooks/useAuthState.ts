"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getRoleHome } from "@/lib/roles";

export type AuthRole = "client" | "kinglancer" | "admin" | null;

export type AuthState = {
  isLoggedIn: boolean;
  authReady: boolean;
  firstName: string;
  role: AuthRole;
  dashboardHref: string;
  clearAuthState: () => void;
};

/**
 * Shared auth state for public pages (Navbar, HeroSection).
 * Reads the local session first (no network), then validates with getUser()
 * and fetches the profile — all in parallel — so there is only one DB
 * round-trip per mount.
 */
export function useAuthState(): AuthState {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [role, setRole] = useState<AuthRole>(null);
  const [dashboardHref, setDashboardHref] = useState("/dashboard/client");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    (async () => {
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

        if (!cancelled && authData.user) {
          setIsLoggedIn(true);
          if (profile?.full_name) setFirstName(profile.full_name.split(" ")[0]);
          setRole(profile?.role ?? null);
          setDashboardHref(getRoleHome(profile?.role));
        }
      }
      if (!cancelled) setAuthReady(true);
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      if (cancelled) return;
      setIsLoggedIn(!!session?.user);
      if (!session?.user) {
        setFirstName("");
        setRole(null);
        setDashboardHref("/dashboard/client");
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  /** Call this on sign-out to reset all auth state immediately. */
  const clearAuthState = useCallback(() => {
    setIsLoggedIn(false);
    setFirstName("");
    setRole(null);
    setDashboardHref("/dashboard/client");
  }, []);

  return { isLoggedIn, authReady, firstName, role, dashboardHref, clearAuthState };
}
