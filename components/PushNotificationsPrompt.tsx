"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { usePushNotifications } from "@/lib/hooks/usePushNotifications";

const DISMISS_KEY = "push-prompt-dismissed";

export default function PushNotificationsPrompt() {
  const { supported, permission, subscribed, busy, subscribe } =
    usePushNotifications();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    (async () => {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    })();
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (
    !supported ||
    dismissed ||
    subscribed ||
    permission === "denied" ||
    permission === "unsupported"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl bg-white p-4 shadow-xl shadow-slate-950/10 ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Bell className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">
            Turn on notifications
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Get notified instantly about new jobs, applications and payments.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={async () => {
                const ok = await subscribe();
                if (ok) dismiss();
              }}
              disabled={busy}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy ? "Enabling…" : "Enable"}
            </button>
            <button
              onClick={dismiss}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-slate-400 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
