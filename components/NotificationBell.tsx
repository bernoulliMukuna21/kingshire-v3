"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const TYPE_ICON: Record<string, string> = {
  new_application: "📋",
  job_awarded: "🎉",
  work_submitted: "✅",
  payment_released: "💷",
  dispute_raised: "⚠️",
  new_job: "💼",
  payout_ready: "💷",
  direct_request: "📨",
};

export default function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[] | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Poll only the unread count; load full notification bodies when opened.
  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch("/api/notifications?summary=1", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { unread?: number };
        setUnreadCount(data.unread ?? 0);
      } catch {}
    }

    fetchSummary();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchSummary();
    }, 60_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") fetchSummary();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!open || notifications !== null) return;

    async function fetchNotificationList() {
      setLoadingList(true);
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as Notification[];
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.read).length);
      } catch {
      } finally {
        setLoadingList(false);
      }
    }

    fetchNotificationList();
  }, [open, notifications]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = unreadCount;

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnreadCount(0);
    setNotifications((prev) =>
      prev ? prev.map((n) => ({ ...n, read: true })) : prev,
    );
  }

  async function handleClick(n: Notification) {
    if (!n.read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: "PATCH" });
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev
          ? prev.map((item) =>
              item.id === n.id ? { ...item, read: true } : item,
            )
          : prev,
      );
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-white text-sm font-semibold">
              Notifications
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-blue-400 text-xs hover:text-blue-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {loadingList && notifications === null ? (
              <div className="px-4 py-8 text-center text-white/30 text-sm">
                Loading notifications…
              </div>
            ) : !notifications || notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/30 text-sm">
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors flex gap-3 ${
                    n.read ? "opacity-60" : ""
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-xs font-semibold truncate">
                      {n.title}
                      {!n.read && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-blue-400 rounded-full align-middle" />
                      )}
                    </p>
                    <p className="text-white/50 text-xs mt-0.5 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>
                    <p className="text-white/30 text-[10px] mt-1">
                      {timeAgo(n.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
