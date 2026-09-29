import { SUPPORT_EMAIL } from "@/lib/contact";
import { notify, sendEmail } from "./core";

// Mirrors the Placement early-end notifications; roles use a `link` the
// caller builds (workspace path differs by recipient side).

export async function notifyRoleOffer({
  kinglancerId,
  kinglancerEmail,
  jobTitle,
  jobId,
}: {
  kinglancerId: string;
  kinglancerEmail?: string;
  jobTitle: string;
  jobId: string;
}) {
  await notify({
    userId: kinglancerId,
    type: "job_awarded",
    title: "🎉 You've been offered a role!",
    body: `Great news — you've been offered "${jobTitle}"! Review the pay terms and accept to get started.`,
    link: `/dashboard/kinglancer/jobs/${jobId}`,
    email: kinglancerEmail
      ? {
          to: kinglancerEmail,
          subject: `You've been offered: ${jobTitle}`,
          ctaLabel: "Review offer →",
        }
      : undefined,
  });
}

export async function notifyRoleEndProposed({
  recipientId,
  recipientEmail,
  jobTitle,
  proposedBy,
  link,
}: {
  recipientId: string;
  recipientEmail?: string;
  jobTitle: string;
  proposedBy: string;
  link: string;
}) {
  await notify({
    userId: recipientId,
    type: "dispute_raised",
    title: "Request to end a role early",
    body: `${proposedBy} has asked to end "${jobTitle}" early. Open it to confirm or decline.`,
    link,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `${proposedBy} wants to end "${jobTitle}" early`,
          ctaLabel: "Review request →",
        }
      : undefined,
  });
}

export async function notifyRoleEndDeclined({
  recipientId,
  recipientEmail,
  jobTitle,
  declinedBy,
  link,
}: {
  recipientId: string;
  recipientEmail?: string;
  jobTitle: string;
  declinedBy: string;
  link: string;
}) {
  await notify({
    userId: recipientId,
    type: "dispute_raised",
    title: "Early-end request declined",
    body: `${declinedBy} declined the request to end "${jobTitle}" early. The role continues as agreed.`,
    link,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `Request to end "${jobTitle}" early was declined`,
          ctaLabel: "Open KingsHire →",
        }
      : undefined,
  });
}

export async function notifyRoleEnded({
  recipientId,
  recipientEmail,
  jobTitle,
  link,
}: {
  recipientId: string;
  recipientEmail?: string;
  jobTitle: string;
  link: string;
}) {
  await notify({
    userId: recipientId,
    type: "new_job",
    title: "Role ended early",
    body: `"${jobTitle}" has been ended early by mutual agreement. Any period already paid is being reviewed by KingsHire.`,
    link,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `"${jobTitle}" has ended`,
          ctaLabel: "Open KingsHire →",
        }
      : undefined,
  });
}

export async function notifyAdminRoleEndDispute({
  jobTitle,
  organisationName,
  raisedBy,
  reason,
}: {
  jobTitle: string;
  organisationName: string;
  raisedBy: string;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Role early-end dispute] ${jobTitle}`,
    title: "An early-end disagreement needs mediation",
    body: `${raisedBy} asked KingsHire to settle a disagreement about ending "${jobTitle}" (${organisationName}) early. The role is still active and any funded period is held in escrow.\n\nContext:\n${reason || "(no reason given)"}`,
    link: `${appUrl}/admin/role-disputes`,
    ctaLabel: "Open admin →",
  });
}
