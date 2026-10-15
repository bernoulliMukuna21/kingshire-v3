import { cache } from "react";
import { getAdminDb } from "./access";
import { collectPages } from "@/lib/db/pagination";
import { stripe } from "@/lib/stripe";
import { getAdminStripeActivity } from "@/lib/admin-stripe-financials";
import { coerceNumericList } from "@/lib/db/coerce";
import { reconcileAdminFunding } from "./reconciliation";
import { deriveAdminFinancials } from "@/lib/admin-financials";

async function collectStripe<T>(rows: AsyncIterable<T>) {
  const result: T[] = [];
  for await (const row of rows) result.push(row);
  return result;
}

export const getAdminFinances = cache(async () => {
  const db = await getAdminDb();
  async function available<T>(read: PromiseLike<T>): Promise<T | null> {
    try {
      return await read;
    } catch (error) {
      console.error("[admin finances]", error);
      return null;
    }
  }
  const [transactions, engagementPayments, balance, stripeActivity] =
    await Promise.all([
      available(
        collectPages((from, to) =>
          db.from("transactions").select("*").order("id").range(from, to),
        ),
      ),
      available(
        collectPages((from, to) =>
          db
            .from("engagement_payments")
            .select("*")
            .order("id")
            .range(from, to),
        ),
      ),
      available(stripe.balance.retrieve()),
      available(getAdminStripeActivity()),
    ]);
  const availablePence =
    balance?.available.find((row) => row.currency === "gbp")?.amount ??
    (balance ? 0 : null);
  const pendingPence =
    balance?.pending.find((row) => row.currency === "gbp")?.amount ??
    (balance ? 0 : null);
  let summary: ReturnType<typeof deriveAdminFinancials> = null;
  let reconciliation: ReturnType<typeof reconcileAdminFunding> | null = null;
  try {
    if (transactions && engagementPayments && stripeActivity) {
      const [charges, transfers, invoicePayments] = await Promise.all([
        collectStripe(stripe.charges.list({ limit: 100 })),
        collectStripe(stripe.transfers.list({ limit: 100 })),
        collectStripe(
          stripe.invoicePayments.list({
            status: "paid",
            limit: 100,
            expand: ["data.invoice"],
          }),
        ),
      ]);
      const oneOff = coerceNumericList(transactions, [
        "amount",
        "platform_fee_client",
        "platform_fee_kinglancer",
      ]);
      const recurring = coerceNumericList(engagementPayments, [
        "worker_amount",
        "platform_fee_client",
        "platform_fee_kinglancer",
      ]);
      reconciliation = reconcileAdminFunding({
        ledger: [
          ...oneOff
            .filter(
              (row) =>
                row.payment_method === "card" &&
                ["held", "released", "disputed", "refunded"].includes(
                  row.status,
                ),
            )
            .map((row) => ({
              ...row,
              manuallyPaid: !!row.manual_payout_reference,
              expectedChargePence: Math.round(
                (row.amount + row.platform_fee_client) * 100,
              ),
              expectedWorkerPence: Math.round(
                (row.amount - row.platform_fee_kinglancer) * 100,
              ),
            })),
          ...recurring
            .filter((row) =>
              ["held", "released", "disputed", "refunded"].includes(row.status),
            )
            .map((row) => ({
              ...row,
              expectedChargePence: Math.round(
                (row.worker_amount +
                  row.platform_fee_client +
                  (row.worker_amount === 0 ? row.platform_fee_kinglancer : 0)) *
                  100,
              ),
              expectedWorkerPence: Math.round(
                (row.worker_amount === 0
                  ? 0
                  : row.worker_amount - row.platform_fee_kinglancer) * 100,
              ),
            })),
        ],
        receipts: charges.map((row) => ({
          id: row.id,
          intentId:
            typeof row.payment_intent === "string"
              ? row.payment_intent
              : (row.payment_intent?.id ?? null),
          amount: row.amount,
          refunded: row.amount_refunded,
          paid: row.paid,
        })),
        transfers: transfers.map((row) => ({
          id: row.id,
          amount: row.amount,
          reversed: row.reversed,
        })),
        subscriptionIntentIds: invoicePayments.flatMap((row) => {
          const invoice = row.invoice;
          if (
            typeof invoice === "string" ||
            ("deleted" in invoice && invoice.deleted) ||
            !("parent" in invoice) ||
            invoice.parent?.type !== "subscription_details"
          )
            return [];
          const intent = row.payment.payment_intent;
          return intent
            ? [typeof intent === "string" ? intent : intent.id]
            : [];
        }),
      });
      if (process.env.APP_ENV === "staging" && balance?.livemode)
        reconciliation.issues.push(
          "Staging is connected to live Stripe. Verify environment credentials.",
        );
      if (process.env.APP_ENV === "production" && balance && !balance.livemode)
        reconciliation.issues.push(
          "Production is connected to test Stripe. Verify environment credentials.",
        );
      if (reconciliation.issues.length)
        stripeActivity.needsReconciliation = true;
    }
  } catch (error) {
    console.error("[admin finances] reconciliation unavailable", error);
    reconciliation = {
      issues: ["Stripe payment matching is unavailable."],
      differences: [],
    };
    if (stripeActivity) stripeActivity.needsReconciliation = true;
  }
  try {
    summary = deriveAdminFinancials({
      transactions,
      engagementPayments,
      stripeAvailablePence: availablePence,
      stripeActivity,
    });
  } catch (error) {
    console.error("[admin finances] invalid ledger", error);
  }
  return {
    summary,
    availableGBP: availablePence === null ? null : availablePence / 100,
    pendingGBP: pendingPence === null ? null : pendingPence / 100,
    reconciliation,
    testMode: balance ? !balance.livemode : null,
  };
});
