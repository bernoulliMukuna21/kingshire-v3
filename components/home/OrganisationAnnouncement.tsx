"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";

const STORAGE_KEY = "kingshire:organisation-announcement-dismissed";
const EXPIRY = new Date("2026-08-09T00:00:00+01:00").getTime();
const CHANGE_EVENT = "kingshire:organisation-announcement-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot() {
  return Date.now() < EXPIRY && localStorage.getItem(STORAGE_KEY) !== "1";
}

export default function OrganisationAnnouncement() {
  const { authReady, role } = usePublicAuth();
  const withinCampaign = useSyncExternalStore(subscribe, getSnapshot, () => false);

  if (!authReady || role === "kinglancer" || !withinCampaign) return null;

  return (
    <div className="border-b border-blue-300/20 bg-blue-600 text-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-sm sm:px-6">
        <p className="min-w-0 flex-1">
          <strong>New: Organisation workspaces.</strong>{" "}
          <span className="text-white/80">
            Create your Organisation, invite your team and publish jobs
            together.
          </span>
        </p>
        <Link
          href="/for-organisations"
          className="shrink-0 font-bold underline decoration-white/40 underline-offset-4 hover:decoration-white"
        >
          Discover
        </Link>
        <button
          type="button"
          aria-label="Dismiss Organisation announcement"
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, "1");
            window.dispatchEvent(new Event(CHANGE_EVENT));
          }}
          className="shrink-0 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
