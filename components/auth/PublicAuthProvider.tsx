"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuthState, type AuthState } from "@/lib/hooks/useAuthState";

const PublicAuthContext = createContext<AuthState | null>(null);

export function PublicAuthProvider({ children }: { children: ReactNode }) {
  const authState = useAuthState();

  return (
    <PublicAuthContext.Provider value={authState}>
      {children}
    </PublicAuthContext.Provider>
  );
}

export function usePublicAuth() {
  const authState = useContext(PublicAuthContext);
  if (!authState) {
    throw new Error("usePublicAuth must be used within PublicAuthProvider");
  }
  return authState;
}
