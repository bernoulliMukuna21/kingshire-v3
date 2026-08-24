import { createServiceClient } from "@/lib/supabase/service";

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

// ── Convenience wrappers ───────────────────────────────────

export async function notifyPlacementApplicationReceived({
  recipientId,
  recipientEmail,
  placementTitle,
  placementId,
  organisationId,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  placementId: string;
  organisationId: string;
}) {
  await notify({
    userId: recipientId,
    type: "new_application",
    title: "New placement application",
    body: `A Kinglancer has applied to your placement "${placementTitle}".`,
    link: `/dashboard/organisations/${organisationId}/placements/${placementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `New application: ${placementTitle}`,
          ctaLabel: "Review applicant →",
        }
      : undefined,
  });
}

export async function notifyPlacementOffer({
  kinglancerId,
  kinglancerEmail,
  placementTitle,
  agreementId,
}: {
  kinglancerId: string;
  kinglancerEmail?: string;
  placementTitle: string;
  agreementId: string;
}) {
  await notify({
    userId: kinglancerId,
    type: "job_awarded",
    title: "Placement offer",
    body: `You've been offered the placement "${placementTitle}". Review and accept the agreement to begin.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: kinglancerEmail
      ? {
          to: kinglancerEmail,
          subject: `You've been offered: ${placementTitle}`,
          ctaLabel: "Review agreement →",
        }
      : undefined,
  });
}

export async function notifyPlacementReviewed({
  recipientId,
  recipientEmail,
  placementTitle,
  organisationId,
  placementId,
  approved,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  organisationId: string;
  placementId: string;
  approved: boolean;
}) {
  await notify({
    userId: recipientId,
    type: "new_job",
    title: approved ? "Placement approved" : "Placement not approved",
    body: approved
      ? `Your placement "${placementTitle}" passed review and is now live.`
      : `Your placement "${placementTitle}" wasn't approved. Please review it and try again.`,
    link: `/dashboard/organisations/${organisationId}/placements/${placementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: approved
            ? `Approved: ${placementTitle}`
            : `Not approved: ${placementTitle}`,
          ctaLabel: "View placement →",
        }
      : undefined,
  });
}

export async function notifyNewApplication({
  clientId,
  clientEmail,
  jobTitle,
  jobId,
}: {
  clientId: string;
  clientEmail: string;
  jobTitle: string;
  jobId: string;
}) {
  await notify({
    userId: clientId,
    type: "new_application",
    title: "New application received",
    body: `Someone applied to your job "${jobTitle}". Review their application and decide whether to hire them.`,
    link: `/dashboard/client/jobs/${jobId}`,
    email: {
      to: clientEmail,
      subject: `New application for "${jobTitle}"`,
      ctaLabel: "Review application →",
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
      : "Payment did not complete",
    body: isClient
      ? `Your card payment for "${jobTitle}" failed. No one has been hired yet. Please retry or cancel the pending payment from your dashboard.`
      : `The client's payment for "${jobTitle}" did not complete. We'll notify you if the client completes escrow.`,
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
    body: `The ${raisedBy} has raised a dispute on "${jobTitle}". Our team will review it shortly.\n\nIf you have any questions or evidence to share, please email us directly at kingshirecompany@gmail.com — include the job title in your message.`,
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
    body: `A dispute has been raised by the ${raisedBy} (${raisedByEmail}) on job "${jobTitle}".\n\nReason:\n${reason}`,
    link: `${appUrl}/admin?dispute=${jobId}`,
    ctaLabel: "View in admin →",
  });
}

export async function notifyAdminPlacementForReview({
  placementTitle,
  organisationName,
}: {
  placementTitle: string;
  organisationName: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail =
    process.env.ADMIN_NOTIFICATION_EMAIL ?? "kingshirecompany@gmail.com";
  await sendEmail({
    to: adminEmail,
    subject: `[Placement review] ${placementTitle}`,
    title: "Placement awaiting review",
    body: `${organisationName} has published a placement opportunity, "${placementTitle}", that is ready for your review before it goes live.`,
    link: `${appUrl}/admin/placements`,
    ctaLabel: "Review placement →",
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

function dashboardJobLink(role: "client" | "kinglancer", jobId: string) {
  return `/dashboard/${role}/jobs/${jobId}`;
}

export async function notifyReviewRequest({
  userId,
  userEmail,
  role,
  jobId,
  jobTitle,
  counterpartName,
}: {
  userId: string;
  userEmail: string;
  role: "client" | "kinglancer";
  jobId: string;
  jobTitle: string;
  counterpartName: string;
}) {
  await notify({
    userId,
    type: "review_request",
    title: "Leave a review",
    body: `"${jobTitle}" is complete. Share your honest feedback on working with ${counterpartName} — reviews stay hidden until you both submit or the 7-day window closes.`,
    link: dashboardJobLink(role, jobId),
    email: {
      to: userEmail,
      subject: `How was working on "${jobTitle}"?`,
      ctaLabel: "Leave a review →",
    },
  });
}

export async function notifyReviewReceived({
  userId,
  userEmail,
  role,
  jobId,
  jobTitle,
}: {
  userId: string;
  userEmail: string;
  role: "client" | "kinglancer";
  jobId: string;
  jobTitle: string;
}) {
  await notify({
    userId,
    type: "review_received",
    title: "You received a review",
    body: `Your review for "${jobTitle}" is now public. See what was said and how it affects your KingsHire reputation.`,
    link: dashboardJobLink(role, jobId),
    email: {
      to: userEmail,
      subject: `You received a review for "${jobTitle}"`,
      ctaLabel: "View your review →",
    },
  });
}

/**
 * Sends a "leave a review" prompt to BOTH parties of a completed job.
 * Safe to call fire-and-forget; resolves quietly if data is missing.
 */
export async function notifyReviewRequestsForJob(
  jobId: string,
  jobTitle: string,
) {
  const db = createServiceClient();
  const { data: job } = await db
    .from("jobs")
    .select("client_id, kinglancer_id")
    .eq("id", jobId)
    .single();

  if (!job?.client_id || !job?.kinglancer_id) return;

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [job.client_id, job.kinglancer_id]);

  const client = profiles?.find((p) => p.id === job.client_id);
  const kinglancer = profiles?.find((p) => p.id === job.kinglancer_id);
  const clientName = client?.full_name ?? "the client";
  const kinglancerName = kinglancer?.full_name ?? "the kinglancer";

  await Promise.all([
    client?.email
      ? notifyReviewRequest({
          userId: job.client_id,
          userEmail: client.email,
          role: "client",
          jobId,
          jobTitle,
          counterpartName: kinglancerName,
        })
      : Promise.resolve(),
    kinglancer?.email
      ? notifyReviewRequest({
          userId: job.kinglancer_id,
          userEmail: kinglancer.email,
          role: "kinglancer",
          jobId,
          jobTitle,
          counterpartName: clientName,
        })
      : Promise.resolve(),
  ]);
}

/**
 * Sends a job-alert email only — does not create an in-app notification
 * record. Call this after the bulk in-app insert in the job creation route.
 */
export async function emailJobAlert({
  to,
  jobTitle,
  jobId,
  isDirect = false,
}: {
  to: string;
  jobTitle: string;
  jobId: string;
  isDirect?: boolean;
}) {
  await sendEmail({
    to,
    subject: isDirect
      ? `Direct job request: "${jobTitle}"`
      : `New job posted: "${jobTitle}"`,
    title: isDirect ? "New direct job request" : "New job posted",
    body: isDirect
      ? `You have received a direct job request: "${jobTitle}". Log in to review and respond.`
      : `A new job has just been posted: "${jobTitle}". Be one of the first to apply!`,
    link: `/jobs/${jobId}`,
    ctaLabel: isDirect ? "View request →" : "View job →",
  });
}

/**
 * Notifies a kinglancer (or invited kinglancer on a direct request) that the
 * client has cancelled the job. Used for both open-job cancellations and
 * in-progress cancellations within the grace period.
 */
export async function notifyJobCancelled({
  recipientId,
  recipientEmail,
  jobTitle,
  refunded,
}: {
  recipientId: string;
  recipientEmail: string;
  jobTitle: string;
  /** True when the client received a Stripe refund (in-progress grace period). */
  refunded: boolean;
}) {
  const body = refunded
    ? `The client cancelled the job "${jobTitle}" within the grace period. The payment has been refunded to them. This job is now closed.`
    : `The client has cancelled the job posting "${jobTitle}". It is no longer available on the platform.`;

  await notify({
    userId: recipientId,
    type: "dispute_raised", // closest available type without a schema change
    title: "Job cancelled by client",
    body,
    link: "/dashboard/kinglancer",
    email: {
      to: recipientEmail,
      subject: `Job cancelled: "${jobTitle}"`,
    },
  });
}

// ── Email delivery ─────────────────────────────────────────

export async function emailOrganisationInvitation({
  to,
  organisationName,
  inviterName,
  invitationUrl,
}: {
  to: string;
  organisationName: string;
  inviterName: string;
  invitationUrl: string;
}) {
  return sendEmail({
    to,
    subject: `Invitation to join ${organisationName} on KingsHire`,
    title: `Join ${organisationName}`,
    body: `${inviterName} has invited you to join their Organisation workspace on KingsHire.`,
    link: invitationUrl,
    ctaLabel: "Review invitation",
  });
}

async function sendEmail({
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
            <p style="margin:0;color:#94a3b8;font-size:12px">Need help? Email us at <a href="mailto:kingshirecompany@gmail.com" style="color:#94a3b8">kingshirecompany@gmail.com</a></p>
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
