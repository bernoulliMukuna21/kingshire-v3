import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import {
  getEngagement,
  type Engagement,
} from "@/lib/db/engagements";
import {
  getHeldEngagementPayments,
  updateEngagementPaymentStatus,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import { periodEnd, releaseNoticeDays } from "./schedule";
import { getOrgOwnerContact } from "@/lib/organisations";
import { notifyEngagementReleasePending } from "@/lib/notifications";

/** Resolves the human-facing title and dashboard link for whatever this
 * engagement represents — org roles and placements are both `engagements`,
 * but each is fronted by its own domain table. */
async function resolveEngagementSource(
  engagement: Engagement,
): Promise<{ title: string; link: string } | null> {
  const db = createServiceClient();
  if (engagement.source_kind === "org_role") {
    const { data: job } = await db
      .from("jobs")
      .select("title")
      .eq("id", engagement.source_id)
      .maybeSingle();
    if (!job) return null;
    return {
      title: job.title,
      link: `/dashboard/organisations/${engagement.organisation_id}/jobs/${engagement.source_id}`,
    };
  }
  const { data: agreement } = await db
    .from("placement_agreements")
    .select("placement:placements(title)")
    .eq("id", engagement.source_id)
    .maybeSingle();
  const title = (
    agreement?.placement as { title?: string } | { title?: string }[] | null
  ) ?? null;
  const placementTitle = Array.isArray(title)
    ? (title[0]?.title ?? null)
    : (title?.title ?? null);
  if (!placementTitle) return null;
  return {
    title: placementTitle,
    link: `/dashboard/placements/agreements/${engagement.source_id}`,
  };
}

async function sendReleaseNotice(
  payment: EngagementPaymentRow,
  engagement: Engagement,
  releaseAt: number,
): Promise<boolean> {
  const [source, orgOwner] = await Promise.all([
    resolveEngagementSource(engagement),
    getOrgOwnerContact(engagement.organisation_id),
  ]);
  if (!source || !orgOwner?.email) return false;
  await notifyEngagementReleasePending({
    organisationEmail: orgOwner.email,
    title: source.title,
    link: source.link,
    periodIndex: payment.period_index,
    releaseDate: new Date(releaseAt).toISOString().slice(0, 10),
  });
  return true;
}

export type EngagementPayoutResult =
  | "released"
  | "pending_onboarding"
  | "already_transferred"
  | "skipped"
  | "not_eligible";

export async function releaseEngagementPayment(
  paymentId: string,
): Promise<EngagementPayoutResult> {
  const db = createServiceClient();
  const { data: payment, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  // Admin may release a 'disputed' period directly (bypassing the normal
  // held→released cron path), so this accepts both — matching the pre-engine
  // Placement payout behaviour, which had no status guard beyond the transfer id.
  if (!payment || (payment.status !== "held" && payment.status !== "disputed")) {
    return "not_eligible";
  }
  if (payment.stripe_transfer_id) return "already_transferred";

  const engagement = await getEngagement(payment.engagement_id);
  if (!engagement || engagement.settlement_mode !== "managed") {
    return "not_eligible";
  }

  const { data: profile } = await db
    .from("profiles")
    .select("stripe_account_id, stripe_onboarding_complete")
    .eq("id", payment.kinglancer_id)
    .single();
  if (!profile?.stripe_onboarding_complete || !profile.stripe_account_id) {
    return "pending_onboarding";
  }

  const netPence = Math.round(
    (Number(payment.worker_amount) -
      Number(payment.platform_fee_kinglancer)) *
      100,
  );
  if (netPence <= 0) return "skipped";

  let sourceTransaction: string | undefined;
  if (payment.stripe_payment_intent_id) {
    try {
      const intent = await stripe.paymentIntents.retrieve(
        payment.stripe_payment_intent_id,
      );
      const charge = intent.latest_charge;
      if (charge) {
        sourceTransaction = typeof charge === "string" ? charge : charge.id;
      }
    } catch (error) {
      console.warn("[settlement] could not resolve source charge:", error);
    }
  }

  const transfer = await stripe.transfers.create(
    {
      amount: netPence,
      currency: "gbp",
      destination: profile.stripe_account_id,
      ...(sourceTransaction ? { source_transaction: sourceTransaction } : {}),
      metadata: {
        engagement_payment_id: payment.id,
        engagement_id: payment.engagement_id,
      },
    },
    { idempotencyKey: `engagement-transfer-${payment.id}` },
  );

  await updateEngagementPaymentStatus(payment.id, "released", {
    stripe_transfer_id: transfer.id,
    released_at: new Date().toISOString(),
  });
  return "released";
}

function periodEndTimestamp(
  payment: EngagementPaymentRow,
  engagement: Engagement,
): number {
  return periodEnd(
    new Date(`${payment.due_date}T00:00:00.000Z`),
    engagement.cadence,
  ).getTime();
}

export type ProcessReleaseResult = {
  released: number;
  noticed: number;
  pendingOnboarding: number;
};

/** Release eligible managed periods and mark upcoming periods as noticed. */
export async function processEngagementReleases(): Promise<ProcessReleaseResult> {
  const payments = await getHeldEngagementPayments();
  const now = Date.now();
  let released = 0;
  let noticed = 0;
  let pendingOnboarding = 0;

  for (const payment of payments) {
    const engagement = await getEngagement(payment.engagement_id);
    if (!engagement || engagement.settlement_mode !== "managed") continue;

    const end = periodEndTimestamp(payment, engagement);
    if (end <= now) {
      const result = await releaseEngagementPayment(payment.id);
      if (result === "released") released += 1;
      if (result === "pending_onboarding") pendingOnboarding += 1;
      continue;
    }

    const noticeAt =
      end - releaseNoticeDays(engagement.cadence) * 24 * 60 * 60 * 1000;
    if (now >= noticeAt && !payment.notice_sent_at) {
      // Only record notice_sent_at once the notice actually goes out —
      // otherwise a failed send (or an org with no resolvable owner) would
      // be marked "sent" and never retried.
      const sent = await sendReleaseNotice(payment, engagement, end).catch(
        (error) => {
          console.error(
            `[settlement] release notice failed for payment ${payment.id}:`,
            error,
          );
          return false;
        },
      );
      if (sent) {
        await updateEngagementPaymentStatus(payment.id, "held", {
          notice_sent_at: new Date().toISOString(),
        });
        noticed += 1;
      }
    }
  }

  return { released, noticed, pendingOnboarding };
}
