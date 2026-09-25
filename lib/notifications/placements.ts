import { createServiceClient } from "@/lib/supabase/service";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { notify, sendEmail } from "./core";

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
    title: "🎉 New placement application!",
    body: `Nice one — a Kinglancer just applied to your placement "${placementTitle}". Take a look and see if they're a great fit!`,
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
    title: "🎉 You've been offered a placement!",
    body: `Great news — you've been offered "${placementTitle}"! Review the agreement and accept to get started.`,
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
  reason,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  organisationId: string;
  placementId: string;
  approved: boolean;
  reason?: string;
}) {
  await notify({
    userId: recipientId,
    type: "new_job",
    title: approved
      ? "🎉 Your placement is live!"
      : "Your placement needs a small update",
    body: approved
      ? `Great news — "${placementTitle}" passed review and is now live for Kinglancers to discover!`
      : `Your placement "${placementTitle}" wasn't approved yet.${
          reason ? ` Reason: ${reason}` : ""
        } Make the update and resubmit — you're almost there.`,
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

export async function notifyPlacementCheckIn({
  recipientId,
  recipientEmail,
  placementTitle,
  agreementId,
  authorName,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  agreementId: string;
  authorName: string;
}) {
  await notify({
    userId: recipientId,
    type: "work_submitted",
    title: "📝 New check-in posted",
    body: `${authorName} just posted a check-in on "${placementTitle}" — take a look at the latest update.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `New check-in: ${placementTitle}`,
          ctaLabel: "View check-in →",
        }
      : undefined,
  });
}

export async function notifyExperienceVerified({
  kinglancerId,
  kinglancerEmail,
  categories,
  organisationName,
  approved,
}: {
  kinglancerId: string;
  kinglancerEmail?: string;
  categories: string[];
  organisationName: string;
  approved: boolean;
}) {
  const label = categories[0] ?? "placement";
  await notify({
    userId: kinglancerId,
    type: "review_received",
    title: approved ? "🎉 Your placement is verified!" : "Verification update",
    body: approved
      ? `Congratulations — your ${label} placement with ${organisationName} is now verified on your profile! It's a great addition to your Placement Passport.`
      : `Your ${label} placement verification wasn't approved this time.`,
    link: "/dashboard/profile",
    email: kinglancerEmail
      ? {
          to: kinglancerEmail,
          subject: approved
            ? "Your placement is verified"
            : "Verification update",
          ctaLabel: "View profile →",
        }
      : undefined,
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
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Placement review] ${placementTitle}`,
    title: "Placement awaiting review",
    body: `${organisationName} has published a placement opportunity, "${placementTitle}", that is ready for your review before it goes live.`,
    link: `${appUrl}/admin/placements`,
    ctaLabel: "Review placement →",
  });
}

export async function notifyAdminPlacementIssue({
  placementTitle,
  organisationName,
  kinglancerName,
  kinglancerEmail,
  reason,
}: {
  placementTitle: string;
  organisationName: string;
  kinglancerName: string;
  kinglancerEmail: string;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Placement issue] ${placementTitle}`,
    title: "A Kinglancer reported a placement issue",
    body: `${kinglancerName} (${kinglancerEmail}) reported an issue on the placement "${placementTitle}" with ${organisationName}.\n\nWhat they said:\n${reason}`,
    link: `${appUrl}/admin/placements`,
    ctaLabel: "Open admin →",
  });
}

export async function notifyAdminPlacementDispute({
  placementTitle,
  organisationName,
  periodIndex,
  reason,
}: {
  placementTitle: string;
  organisationName: string;
  periodIndex: number;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Placement dispute] ${placementTitle} — month ${periodIndex}`,
    title: "An organisation disputed a placement payment",
    body: `${organisationName} disputed month ${periodIndex} of "${placementTitle}". The payment is held pending your resolution (release to the Kinglancer or refund the organisation).\n\nReason:\n${reason}`,
    link: `${appUrl}/admin/placement-disputes`,
    ctaLabel: "Resolve in admin →",
  });
}

export async function notifyPlacementEndDeclined({
  recipientId,
  recipientEmail,
  placementTitle,
  declinedBy,
  agreementId,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  declinedBy: string;
  agreementId: string;
}) {
  await notify({
    userId: recipientId,
    type: "dispute_raised", // reuse existing type — no schema change needed
    title: "Your early-end request was declined",
    body: `${declinedBy} declined ending "${placementTitle}" early, so it continues. If you can't reach agreement, you can ask KingsHire to step in from the placement.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `Early-end declined: ${placementTitle}`,
          ctaLabel: "Open placement →",
        }
      : undefined,
  });
}

export async function notifyAdminPlacementEndDispute({
  placementTitle,
  organisationName,
  raisedBy,
  reason,
}: {
  placementTitle: string;
  organisationName: string;
  raisedBy: string;
  reason: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kingshire.uk";
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL ?? SUPPORT_EMAIL;
  await sendEmail({
    to: adminEmail,
    subject: `[Placement early-end dispute] ${placementTitle}`,
    title: "An early-end disagreement needs mediation",
    body: `${raisedBy} asked KingsHire to settle a disagreement about ending "${placementTitle}" (${organisationName}) early. The placement is still active and any funded month is held in escrow.\n\nContext:\n${reason || "(no reason given)"}`,
    link: `${appUrl}/admin/placements`,
    ctaLabel: "Open admin →",
  });
}

export async function notifyPlacementEndProposed({
  recipientId,
  recipientEmail,
  placementTitle,
  proposedBy,
  agreementId,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  proposedBy: string;
  agreementId: string;
}) {
  await notify({
    userId: recipientId,
    type: "dispute_raised",
    title: "Request to end a placement early",
    body: `${proposedBy} has asked to end "${placementTitle}" early. Open it to confirm or decline.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `${proposedBy} wants to end "${placementTitle}" early`,
          ctaLabel: "Review request →",
        }
      : undefined,
  });
}

export async function notifyPlacementEnded({
  recipientId,
  recipientEmail,
  placementTitle,
  agreementId,
}: {
  recipientId: string;
  recipientEmail?: string;
  placementTitle: string;
  agreementId: string;
}) {
  await notify({
    userId: recipientId,
    type: "new_job",
    title: "Placement ended early",
    body: `"${placementTitle}" has been ended early by mutual agreement. Any month already paid is being reviewed by KingsHire.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: recipientEmail
      ? {
          to: recipientEmail,
          subject: `"${placementTitle}" has ended`,
          ctaLabel: "Open KingsHire →",
        }
      : undefined,
  });
}

export async function notifyPlacementReadyToFund({
  organisationId,
  placementId,
  agreementId,
}: {
  organisationId: string;
  placementId: string;
  agreementId: string;
}) {
  const db = createServiceClient();
  const [{ data: owner }, { data: placement }] = await Promise.all([
    db
      .from("organisation_members")
      .select("user_id, profiles:profiles!user_id(email)")
      .eq("organisation_id", organisationId)
      .eq("role", "owner")
      .maybeSingle(),
    db.from("placements").select("title").eq("id", placementId).maybeSingle(),
  ]);
  const ownerId = (owner as { user_id?: string } | null)?.user_id;
  if (!ownerId) return;
  const p = (
    owner as unknown as {
      profiles: { email: string | null }[] | { email: string | null } | null;
    }
  ).profiles;
  const email = Array.isArray(p)
    ? (p[0]?.email ?? undefined)
    : (p?.email ?? undefined);
  const title = placement?.title ?? "your placement";
  await notify({
    userId: ownerId,
    type: "dispute_raised", // reuse existing type — no schema change needed
    title: "🎉 Your Kinglancer accepted!",
    body: `Great news — they've accepted "${title}"! Fund the first month to kick things off — it's held safely in escrow until month-end.`,
    link: `/dashboard/placements/agreements/${agreementId}`,
    email: email
      ? {
          to: email,
          subject: `Fund "${title}" to get started`,
          ctaLabel: "Fund the first month →",
        }
      : undefined,
  });
}

export async function notifyPlacementPayoutSetupNeeded({
  kinglancerId,
  placementTitle,
}: {
  kinglancerId: string;
  placementTitle: string;
}) {
  const db = createServiceClient();
  const { data: profile } = await db
    .from("profiles")
    .select("email")
    .eq("id", kinglancerId)
    .maybeSingle();
  await notify({
    userId: kinglancerId,
    type: "payout_ready",
    title: "💰 Your placement pay is waiting!",
    body: `The organisation released your first month for "${placementTitle}" — nice one! Just connect your bank account to receive it, it takes less than 2 minutes.`,
    link: "/dashboard/kinglancer/payouts",
    email: profile?.email
      ? {
          to: profile.email,
          subject: `Set up payouts to receive your "${placementTitle}" pay`,
          ctaLabel: "Set up payouts →",
        }
      : undefined,
  });
}
