import { createServiceClient } from "@/lib/supabase/service";

export type NotificationType =
  | "new_application"
  | "job_awarded"
  | "work_submitted"
  | "payment_released"
  | "dispute_raised"
  | "new_job"
  | "payout_ready";

interface NotifyParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  email?: {
    to: string;
    subject: string;
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

  const brevoApiKey = process.env.BREVO_API_KEY;
  const brevoSenderEmail = process.env.BREVO_SENDER_EMAIL;

  // Email — skip if Brevo is not fully configured.
  if (email && brevoApiKey && brevoSenderEmail) {
    await sendEmail({
      to: email.to,
      subject: email.subject,
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

// ── Convenience wrappers ───────────────────────────────────

export async function notifyNewApplication({
  clientId,
  clientEmail,
  jobTitle,
}: {
  clientId: string;
  clientEmail: string;
  jobTitle: string;
}) {
  await notify({
    userId: clientId,
    type: "new_application",
    title: "New application received",
    body: `Someone applied to your job "${jobTitle}". Review their application and decide whether to hire them.`,
    link: `/dashboard/client`,
    email: {
      to: clientEmail,
      subject: `New application for "${jobTitle}"`,
    },
  });
}

export async function notifyJobAwarded({
  kinglancerId,
  kinglancerEmail,
  jobTitle,
}: {
  kinglancerId: string;
  kinglancerEmail: string;
  jobTitle: string;
}) {
  await notify({
    userId: kinglancerId,
    type: "job_awarded",
    title: "You've been hired!",
    body: `Congratulations — you were selected for "${jobTitle}". Head to your dashboard to get started.`,
    link: `/dashboard/kinglancer`,
    email: {
      to: kinglancerEmail,
      subject: `You got the job: "${jobTitle}"`,
    },
  });
}

export async function notifyWorkSubmitted({
  clientId,
  clientEmail,
  jobTitle,
}: {
  clientId: string;
  clientEmail: string;
  jobTitle: string;
}) {
  await notify({
    userId: clientId,
    type: "work_submitted",
    title: "Work submitted for review",
    body: `Your Kinglancer has marked the work complete on "${jobTitle}". Review and approve to release payment.`,
    link: `/dashboard/client`,
    email: {
      to: clientEmail,
      subject: `Work completed on "${jobTitle}" — your approval needed`,
    },
  });
}

export async function notifyPaymentReleased({
  kinglancerId,
  kinglancerEmail,
  jobTitle,
  amount,
}: {
  kinglancerId: string;
  kinglancerEmail: string;
  jobTitle: string;
  amount: number;
}) {
  await notify({
    userId: kinglancerId,
    type: "payment_released",
    title: "Payment released",
    body: `Your payment of £${amount.toFixed(2)} for "${jobTitle}" has been approved and is on its way.`,
    link: `/dashboard/kinglancer`,
    email: {
      to: kinglancerEmail,
      subject: `Payment released for "${jobTitle}"`,
    },
  });
}

export async function notifyNewJob({
  kinglancerId,
  kinglancerEmail,
  jobTitle,
  jobId,
}: {
  kinglancerId: string;
  kinglancerEmail: string;
  jobTitle: string;
  jobId: string;
}) {
  await notify({
    userId: kinglancerId,
    type: "new_job",
    title: "New job posted",
    body: `A new job has just been posted: "${jobTitle}". Be one of the first to apply!`,
    link: `/jobs/${jobId}`,
    email: {
      to: kinglancerEmail,
      subject: `New job: "${jobTitle}"`,
    },
  });
}
export async function notifyPaymentFailed({
  role,
  email,
  jobTitle,
}: {
  role: "client" | "kinglancer";
  email: string;
  jobTitle: string;
}) {
  const isClient = role === "client";
  await sendEmail({
    to: email,
    subject: `Payment failed for "${jobTitle}"`,
    title: isClient
      ? "Your payment didn't go through"
      : "Job selection cancelled",
    body: isClient
      ? `Your card payment for <strong>${jobTitle}</strong> failed. The job is back to open — you can retry hiring a kinglancer from the job page.`
      : `The client's payment for <strong>${jobTitle}</strong> was declined. The job has been reopened and your application is back to pending. We'll notify you if the client retries.`,
    link: isClient ? `/dashboard/client` : `/dashboard/kinglancer`,
    ctaLabel: isClient ? "View dashboard →" : "View dashboard →",
  });
}

export async function notifyDisputeRaised({
  recipientId,
  recipientEmail,
  jobTitle,
  raisedBy,
}: {
  recipientId: string;
  recipientEmail: string;
  jobTitle: string;
  raisedBy: "client" | "kinglancer";
}) {
  await notify({
    userId: recipientId,
    type: "dispute_raised",
    title: "A dispute has been raised",
    body: `The ${raisedBy} has raised a dispute on "${jobTitle}". Our team will review it shortly.<br><br>If you have any questions or evidence to share, please email us directly at <a href="mailto:kingshirecompany@gmail.com" style="color:#2563eb">kingshirecompany@gmail.com</a> — include the job title in your message.`,
    link: `/dashboard/${raisedBy === "client" ? "kinglancer" : "client"}`,
    email: {
      to: recipientEmail,
      subject: `Dispute raised on "${jobTitle}"`,
    },
  });
}

export async function notifyAdminDisputeRaised({
  jobId,
  jobTitle,
  raisedBy,
  raisedByEmail,
  reason,
}: {
  jobId: string;
  jobTitle: string;
  raisedBy: "client" | "kinglancer";
  raisedByEmail: string;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail =
    process.env.ADMIN_NOTIFICATION_EMAIL ?? "kingshirecompany@gmail.com";
  await sendEmail({
    to: adminEmail,
    subject: `[Dispute] ${jobTitle}`,
    title: "New dispute raised",
    body: `A dispute has been raised by the <strong>${raisedBy}</strong> (${raisedByEmail}) on job <strong>${jobTitle}</strong>.<br><br><strong>Reason:</strong><br>${reason}`,
    link: `${appUrl}/admin?dispute=${jobId}`,
    ctaLabel: "View in admin →",
  });
}

export async function notifyPayoutClaimReady({
  kinglancerId,
  kinglancerEmail,
  jobTitle,
  amount,
  onboardingUrl,
}: {
  kinglancerId: string;
  kinglancerEmail: string;
  jobTitle: string;
  amount: number;
  onboardingUrl: string;
}) {
  await notify({
    userId: kinglancerId,
    type: "payout_ready",
    title: "Your payment is ready to claim",
    body: `Your payment of £${amount.toFixed(2)} for "${jobTitle}" has been approved. Connect your bank account to receive it — takes less than 2 minutes.`,
    link: onboardingUrl, // absolute Stripe URL — used as CTA in email and in-app
    email: {
      to: kinglancerEmail,
      subject: `Your £${amount.toFixed(2)} payment for "${jobTitle}" is ready`,
      ctaLabel: "Set up payouts →",
    },
  });
}

export async function notifyDisputeResolved({
  userId,
  userEmail,
  jobTitle,
  outcome,
  claimUrl,
}: {
  userId: string;
  userEmail: string;
  jobTitle: string;
  outcome: "release" | "refund";
  claimUrl?: string;
}) {
  const isRelease = outcome === "release";
  const title = isRelease
    ? "Dispute resolved — payment released"
    : "Dispute resolved — refund issued";
  const body = isRelease
    ? claimUrl
      ? `The dispute on "${jobTitle}" has been resolved by our team. Your payment is ready to claim — set up your payouts to receive it.`
      : `The dispute on "${jobTitle}" has been resolved by our team. Payment has been released to the Kinglancer.`
    : `The dispute on "${jobTitle}" has been resolved by our team. A full refund has been issued to the client's original payment method.`;
  const link =
    claimUrl ?? (isRelease ? "/dashboard/kinglancer" : "/dashboard/client");

  await notify({
    userId,
    type: "dispute_raised", // reuse existing type — no schema change needed
    title,
    body,
    link,
    email: {
      to: userEmail,
      subject: `Dispute resolved: "${jobTitle}"`,
      ctaLabel: claimUrl ? "Set up payouts →" : "View dashboard →",
    },
  });
}

// ── Email delivery ─────────────────────────────────────────

async function sendEmail({
  to,
  subject,
  title,
  body,
  link,
  ctaLabel,
}: {
  to: string;
  subject: string;
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
      htmlContent: emailTemplate({ title, body, link, ctaLabel }),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }
}

function emailTemplate({
  title,
  body,
  link,
  ctaLabel = "View Details →",
}: {
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
    ? `<a href="${ctaUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${ctaLabel}</a>`
    : "";

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
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a;font-weight:700">${title}</h2>
            <p style="margin:0 0 28px;color:#64748b;line-height:1.7;font-size:15px">${body}</p>
            ${ctaButton}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">© 2026 KingsHire · <a href="${appUrl}" style="color:#94a3b8">kingshire.uk</a></p>
            <p style="margin:0;color:#94a3b8;font-size:12px">Need help? Email us at <a href="mailto:kingshirecompany@gmail.com" style="color:#94a3b8">kingshirecompany@gmail.com</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
