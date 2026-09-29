import { dispatchSettlement } from "./dispatch";
import { stripe } from "@/lib/stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { getEngagement, type Engagement } from "@/lib/db/engagements";
import {
  getHeldEngagementPayments,
  updateEngagementPaymentStatusIf,
  recordEngagementTransfer,
  reserveEngagementRelease,
  recordSettlementError,
  type EngagementPaymentRow,
} from "@/lib/db/engagement-payments";
import {
  anchoredPeriodEnd,
  releaseNoticeDays,
  roleBillingFractions,
} from "./schedule";
import { getOrgOwnerContact } from "@/lib/organisations";
import { notifyEngagementReleasePending } from "@/lib/notifications";
import type { EngagementPaymentStatus } from "./types";

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
  const title =
    (agreement?.placement as
      | { title?: string }
      | { title?: string }[]
      | null) ?? null;
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

/** `mode: "automatic"` (the release cron) may only touch `held` periods;
 * `mode: "admin"` (an explicit override, e.g. resolving a dispute) may also
 * release a `disputed` period. A payment disputed after the cron's scan
 * ran is therefore never released automatically. */
export async function releaseEngagementPayment(
  paymentId: string,
  mode: "automatic" | "admin" = "admin",
): Promise<EngagementPayoutResult> {
  const db = createServiceClient();
  const { data: payment, error } = await db
    .from("engagement_payments")
    .select("*")
    .eq("id", paymentId)
    .maybeSingle();
  if (error) throw error;
  const eligibleStatuses: EngagementPaymentStatus[] =
    mode === "admin" ? ["held", "disputed"] : ["held"];
  if (!payment || !eligibleStatuses.includes(payment.status)) {
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
    (Number(payment.worker_amount) - Number(payment.platform_fee_kinglancer)) *
      100,
  );
  if (netPence <= 0) return "skipped";

  // Reserve BEFORE contacting Stripe — closes the window where a concurrent
  // release/refund/dispute could act on the same un-reserved row.
  const reservation = await reserveEngagementRelease(
    paymentId,
    eligibleStatuses,
    mode,
  );
  if (!reservation) return "not_eligible";

  try {
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

    const transfer = await dispatchSettlement(
      "engagement_payments",
      payment.id,
      reservation.attemptId,
      {
        kind: "transfer",
        params: {
          amount: netPence,
          currency: "gbp",
          destination: profile.stripe_account_id,
          ...(sourceTransaction
            ? { source_transaction: sourceTransaction }
            : {}),
          metadata: {
            engagement_payment_id: payment.id,
            engagement_id: payment.engagement_id,
          },
        },
      },
    );

    const releasedAt = new Date().toISOString();
    // CAS: only flip to "released" if our reservation is still the one
    // holding this row (it always should be — defensive, not load-bearing).
    const settled = await updateEngagementPaymentStatusIf(
      payment.id,
      ["held", "disputed"],
      "released",
      {
        stripe_transfer_id: transfer.id,
        released_at: releasedAt,
        release_outcome: "succeeded",
      },
      { requireReleaseAttemptId: reservation.attemptId },
    );
    if (!settled) {
      // The transfer already succeeded — the transfer id must still be
      // recorded so this is never mistaken for un-transferred money again.
      console.warn(
        `[settlement] payment ${payment.id} released but its status changed concurrently; recording the transfer anyway`,
      );
      await recordEngagementTransfer(payment.id, {
        stripe_transfer_id: transfer.id,
        released_at: releasedAt,
      });
    }
    return "released";
  } catch (err) {
    // A failed response or DB write does not prove that Stripe did nothing.
    await recordSettlementError(paymentId, reservation.attemptId);
    throw err;
  }
}

async function periodEndTimestamp(
  payment: EngagementPaymentRow,
  engagement: Engagement,
): Promise<number> {
  const db = createServiceClient();
  const { data: first, error } = await db
    .from("engagement_payments")
    .select("due_date")
    .eq("engagement_id", engagement.id)
    .eq("period_index", 1)
    .single();
  if (error) throw error;
  if (!first) throw new Error("Payment schedule anchor is missing");
  const fullCadenceEnd = anchoredPeriodEnd(
    new Date(`${first.due_date}T00:00:00.000Z`),
    engagement.cadence,
    payment.period_index,
  ).getTime();

  // A bounded temporary role's final (possibly prorated) period must not
  // wait a full cadence step to release — the role, and the work, ended on
  // its advertised date, not a month after this period started.
  if (engagement.source_kind === "org_role") {
    const { data: job } = await db
      .from("jobs")
      .select("employment_type, scheduled_at, ends_at")
      .eq("id", engagement.source_id)
      .maybeSingle();
    if (
      job?.employment_type === "temporary" &&
      job.scheduled_at &&
      job.ends_at
    ) {
      const fractions = roleBillingFractions(
        new Date(job.scheduled_at),
        new Date(job.ends_at),
        engagement.cadence,
      );
      // The final period is the only one whose payout is bounded by the work
      // end. A small prorated tail is folded INTO this period rather than
      // billed separately, so its cadence end can fall before the work
      // actually ended — releasing on the cadence step would pay out early.
      // Non-final full periods keep their normal cadence release.
      if (payment.period_index >= fractions.length) {
        return new Date(job.ends_at).getTime();
      }
    }
  }
  return fullCadenceEnd;
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

    const end = await periodEndTimestamp(payment, engagement);
    if (end <= now) {
      const result = await releaseEngagementPayment(payment.id, "automatic");
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
        // CAS: a notification must never change settlement state — only
        // record notice_sent_at if this period is still genuinely held and
        // not mid-release.
        const updated = await updateEngagementPaymentStatusIf(
          payment.id,
          ["held"],
          "held",
          { notice_sent_at: new Date().toISOString() },
          { requireReleaseAttemptId: null },
        );
        if (updated) noticed += 1;
      }
    }
  }

  return { released, noticed, pendingOnboarding };
}
