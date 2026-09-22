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

export const isPushConfigured = () => Boolean(vapidPublicKey && vapidPrivateKey);

export interface PushSendResult {
  configured: boolean;
  subscriptionCount: number;
  sent: number;
  failed: Array<{ endpoint: string; error: string }>;
}

/**
 * Push to every device a user has subscribed, returning a diagnostic summary
 * (used by the /api/push/test route). Drops subscriptions the browser has
 * revoked (410/404) so they stop being retried.
 */
async function sendPushToUserWithResult(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    return { configured: false, subscriptionCount: 0, sent: 0, failed: [] };
  }

  const subscriptions = await listPushSubscriptions(userId).catch(() => []);
  if (subscriptions.length === 0) {
    return { configured: true, subscriptionCount: 0, sent: 0, failed: [] };
  }

  const staleEndpoints: string[] = [];
  const failed: Array<{ endpoint: string; error: string }> = [];
  let sent = 0;

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
        sent += 1;
      } catch (err) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(sub.endpoint);
        }
        const message = err instanceof Error ? err.message : String(err);
        failed.push({ endpoint: sub.endpoint, error: message });
        console.error(`[push] send failed for user=${userId}:`, message);
      }
    }),
  );

  await deleteStalePushSubscriptions(staleEndpoints);

  return {
    configured: true,
    subscriptionCount: subscriptions.length,
    sent,
    failed,
  };
}

/**
 * Push to every device a user has subscribed. Fire-and-forget: never throws.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<void> {
  await sendPushToUserWithResult(userId, payload);
}

/** Same as sendPushToUser but returns a diagnostic summary instead of void. */
export async function sendTestPush(
  userId: string,
  payload: PushPayload,
): Promise<PushSendResult> {
  return sendPushToUserWithResult(userId, payload);
}
