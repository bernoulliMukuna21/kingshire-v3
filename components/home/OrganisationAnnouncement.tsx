"use client";

import Link from "next/link";
import { PartyPopper } from "lucide-react";
import { useSyncExternalStore } from "react";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";

const EXPIRY = new Date("2026-08-09T00:00:00+01:00").getTime();

function subscribe(callback: () => void) {
  const timer = window.setInterval(callback, 60_000);
  return () => window.clearInterval(timer);
}

function getSnapshot() {
  return Date.now() < EXPIRY;
}

export default function OrganisationAnnouncement() {
  const { authReady, role } = usePublicAuth();
  const withinCampaign = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (!authReady || role === "kinglancer" || !withinCampaign) return null;

  return (
    <div className="border-b border-fuchsia-300/20 bg-linear-to-r from-violet-700 via-purple-600 to-fuchsia-600 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 sm:flex">
          <PartyPopper size={17} aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1">
          <strong>Something new to celebrate: Organisation workspaces.</strong>{" "}
          <span className="text-white/80">
            Create your Organisation, invite your team and publish jobs
            together.
          </span>
        </p>
        <Link
          href="/for-organisations"
          className="shrink-0 rounded-full bg-white px-3 py-1.5 font-bold text-purple-700 transition hover:bg-purple-50"
        >
          Discover
        </Link>
      </div>
    </div>
  );
}
