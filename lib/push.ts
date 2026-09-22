import webpush from "web-push";
import {
  listPushSubscriptions,
  deleteStalePushSubscriptions,
} from "@/lib/db/push-subscriptions";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:support@kingshire.uk";

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

/**
 * Push to every device a user has subscribed. Fire-and-forget: never throws.
 * Drops subscriptions the browser has revoked (410/404) so they stop being
 * retried.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) return; // not configured — no-op

  const subscriptions = await listPushSubscriptions(userId).catch(() => []);
  if (subscriptions.length === 0) return;

  const staleEndpoints: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        } else {
          console.error(
            `[push] send failed for user=${userId}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }),
  );

  await deleteStalePushSubscriptions(staleEndpoints);
}
