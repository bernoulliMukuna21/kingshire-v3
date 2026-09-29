import { createServiceClient } from "@/lib/supabase/service";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { sendPushToUser } from "@/lib/push";

export type NotificationType =
  | "new_application"
  | "job_awarded"
  | "work_submitted"
  | "payment_released"
  | "dispute_raised"
  | "new_job"
  | "payout_ready"
  | "review_request"
  | "review_received"
  | "job_expired";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  email?: {
    to: string;
    subject: string;
    recipientName?: string;
    ctaLabel?: string;
  };
}

/**
 * Create an in-app notification and optionally send an email.
 * Always inserts the row (using service role). Email is sent only if
 * RESEND_API_KEY is configured — missing key is a graceful no-op.
 */
export async function notify({
  userId,
  type,
  title,
  body,
  link,
  email,
}: NotifyParams): Promise<void> {
  const db = createServiceClient();

  // In-app notification (fire-and-forget, never throw)
  const { error: dbError } = await db
    .from("notifications")
    .insert({ user_id: userId, type, title, body, link });

  if (dbError) {
    console.error(
      `[notify] DB insert failed for type=${type}:`,
      dbError.message,
    );
  }

  // Push — fire-and-forget, never throws; no-op if VAPID isn't configured or
  // the user has no subscribed devices.
  sendPushToUser(userId, { title, body, link }).catch((err: unknown) => {
    console.error(
      `[notify] Push FAILED for user=${userId}:`,
      err instanceof Error ? err.message : err,
    );
  });

  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;

  // Email — skip if Brevo is not fully configured.
  if (email && brevoApiKey && brevoSenderEmail) {
    await sendEmail({
      to: email.to,
      subject: email.subject,
      recipientName: email.recipientName,
      title,
      body,
      link,
      ctaLabel: email.ctaLabel,
    }).catch((err: unknown) => {
      console.error(
        `[notify] Email FAILED to ${email.to}:`,
        err instanceof Error ? err.message : err,
      );
    });
  } else if (email && brevoApiKey && !brevoSenderEmail) {
    console.warn("[notify] BREVO_SENDER_EMAIL is not set; skipping email");
  }
}

// ── Email delivery ─────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  recipientName,
  title,
  body,
  link,
  ctaLabel,
}: {
  to: string;
  subject: string;
  recipientName?: string;
  title: string;
  body: string;
  link?: string;
  ctaLabel?: string;
}) {
  const brevoApiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;

  if (!brevoApiKey || !senderEmail) {
    console.warn("[sendEmail] Brevo is not fully configured; skipping email");
    return;
  }

  if (process.env.ENABLE_EMAIL !== "true") {
    console.log(
      `[sendEmail] ENABLE_EMAIL is not true — skipping email to ${to} (subject: ${subject})`,
    );
    return;
  }

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": brevoApiKey,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME ?? "KingsHire",
        email: senderEmail,
      },
      to: [{ email: to }],
      subject,
      htmlContent: emailTemplate({
        recipientName,
        recipientEmail: to,
        title,
        body,
        link,
        ctaLabel,
      }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function emailTemplate({
  recipientName,
  recipientEmail,
  title,
  body,
  link,
  ctaLabel = "View Details →",
}: {
  recipientName?: string;
  recipientEmail: string;
  title: string;
  body: string;
  link?: string;
  ctaLabel?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  // Support both absolute URLs (e.g. Stripe onboarding) and relative paths
  const ctaUrl = link
    ? link.startsWith("https://") || link.startsWith("http://")
      ? link
      : `${appUrl}${link}`
    : null;
  const ctaButton = ctaUrl
    ? `<a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(ctaLabel)}</a>`
    : "";

  const firstName = getPreferredFirstName(recipientName, recipientEmail);
  const greeting = firstName ? `Dear ${escapeHtml(firstName)},` : "Dear there,";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
        <tr>
          <td style="background:#0f172a;padding:20px 32px">
            <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px">KingsHire</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <p style="margin:0 0 10px;color:#0f172a;line-height:1.6;font-size:15px">${greeting}</p>
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;font-weight:700">${escapeHtml(title)}</h2>
            <p style="margin:0 0 28px;color:#64748b;line-height:1.7;font-size:15px">${escapeHtml(body).replace(/\n/g, "<br>")}</p>
            ${ctaButton}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">© 2026 KingsHire · <a href="${appUrl}" style="color:#94a3b8">kingshire.uk</a></p>
            <p style="margin:0;color:#94a3b8;font-size:12px">Need help? Email us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8">${SUPPORT_EMAIL}</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function getPreferredFirstName(
  recipientName: string | undefined,
  recipientEmail: string,
) {
  const trimmed = recipientName?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0];

  const localPart = recipientEmail.split("@")[0]?.trim();
  if (!localPart) return null;

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, "")
    .trim();

  if (!cleaned) return null;
  const firstToken = cleaned.split(/\s+/)[0];
  if (!firstToken) return null;

  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}
