"use client";

import { useCallback, useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

/**
 * Registers the service worker and exposes web-push subscribe/unsubscribe.
 * `subscribe()` must be called from a user gesture (button click) — iOS
 * Safari silently ignores permission requests made outside one.
 */
export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  useEffect(() => {
    (async () => {
      if (!supported) {
        setPermission("unsupported");
        return;
      }
      setPermission(Notification.permission as PushPermission);

      try {
        const registration = await navigator.serviceWorker.register("/sw.js");
        const existing = await registration.pushManager.getSubscription();
        setSubscribed(!!existing);
      } catch {
        // registration failing is non-fatal — subscribe() will retry
      }
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!supported || !vapidPublicKey) return false;

    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult as PushPermission);
      if (permissionResult !== "granted") return false;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) return false;

      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("[push] subscribe failed:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}
