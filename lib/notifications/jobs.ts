import { createServiceClient } from "@/lib/supabase/service";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { jobAlertHeadline } from "@/lib/jobs";
import { notify, sendEmail } from "./core";

export async function notifyNewApplication({
  clientId,
  clientEmail,
  jobTitle,
  jobId,
  link,
}: {
  clientId: string;
  clientEmail: string;
  jobTitle: string;
  jobId: string;
  link?: string;
}) {
  await notify({
    userId: clientId,
    type: "new_application",
    title: "🎉 You've got a new applicant!",
    body: `Someone just applied to your job "${jobTitle}" — take a look and see if they're the right fit!`,
    link: link ?? `/dashboard/client/jobs/${jobId}`,
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
    title: "🎉 Congratulations, you've been hired!",
    body: `You were selected for "${jobTitle}" — nice work! Head to your dashboard to get started.`,
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
  link,
}: {
  clientId: string;
  clientEmail: string;
  jobTitle: string;
  link?: string;
}) {
  await notify({
    userId: clientId,
    type: "work_submitted",
    title: "✅ Work submitted — ready for your review",
    body: `Your Kinglancer has marked "${jobTitle}" as complete. Take a look and approve to release their payment.`,
    link: link ?? `/dashboard/client`,
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
    title: "💰 You've been paid!",
    body: `Nice one — your payment of £${amount.toFixed(2)} for "${jobTitle}" has been approved and is on its way!`,
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
    title: "🎉 New job posted!",
    body: `A new job just went live: "${jobTitle}". Be one of the first to apply!`,
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
      : "Payment hasn't completed yet",
    body: isClient
      ? `No worries — your card payment for "${jobTitle}" didn't go through, and no one has been hired yet. You can retry or cancel the pending payment from your dashboard.`
      : `The client's payment for "${jobTitle}" hasn't completed yet. We'll let you know as soon as escrow is funded.`,
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
    body: `The ${raisedBy} has raised a dispute on "${jobTitle}". Our team will review it shortly.\n\nIf you have any questions or evidence to share, please email us directly at ${SUPPORT_EMAIL} — include the job title in your message.`,
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
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Dispute] ${jobTitle}`,
    title: "New dispute raised",
    body: `A dispute has been raised by the ${raisedBy} (${raisedByEmail}) on job "${jobTitle}".\n\nReason:\n${reason}`,
    link: `${appUrl}/admin?dispute=${jobId}`,
    ctaLabel: "View in admin →",
  });
}

export async function notifyAdminManualTransferSent({
  jobTitle,
  clientEmail,
  reference,
  amount,
}: {
  jobTitle: string;
  clientEmail: string;
  reference: string;
  amount: number;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Bank transfer] ${jobTitle}`,
    title: "Client says they've sent a bank transfer",
    body: `${clientEmail} says they've sent £${amount.toFixed(2)} for job "${jobTitle}" (reference ${reference}). Please verify it has arrived, then confirm funds received.`,
    link: `${appUrl}/admin/manual-payments`,
    ctaLabel: "Review manual payments →",
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
    title: "💰 Your payment is ready to claim!",
    body: `Your £${amount.toFixed(2)} payment for "${jobTitle}" has been approved! Connect your bank account to receive it, takes less than 2 minutes.`,
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
    ? "🎉 Dispute resolved — payment released!"
    : "Dispute resolved — refund issued";
  const body = isRelease
    ? claimUrl
      ? `Good news — the dispute on "${jobTitle}" has been resolved and your payment is ready to claim! Set up your payouts to receive it.`
      : `Good news — the dispute on "${jobTitle}" has been resolved and payment has been released to the Kinglancer.`
    : `The dispute on "${jobTitle}" has been resolved. A full refund has been issued to the client's original payment method.`;
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
    title: "⭐ How did it go?",
    body: `"${jobTitle}" is all wrapped up! Share your honest feedback on working with ${counterpartName} — reviews stay hidden until you both submit or the 7-day window closes.`,
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
    title: "⭐ You've received a review!",
    body: `Your review for "${jobTitle}" is now public — take a look at what was said and see how it boosts your KingsHire reputation.`,
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
  priceLabel,
  jobId,
  isDirect = false,
}: {
  to: string;
  jobTitle: string;
  priceLabel: string;
  jobId: string;
  isDirect?: boolean;
}) {
  const headline = jobAlertHeadline(jobTitle, priceLabel);
  await sendEmail({
    to,
    subject: isDirect ? `Direct request: ${headline}` : headline,
    title: isDirect ? `Direct request: ${headline}` : headline,
    body: isDirect
      ? `Congratulations 🎉! You have a new direct request! Log in now to review and respond.`
      : `Good News 😀! A new job just went live! Log in now to be one of the first to apply.`,
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
