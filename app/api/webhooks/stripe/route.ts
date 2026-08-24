export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import {
  finalizePaymentAttempt,
  updatePaymentAttemptStatus,
} from "@/lib/db/payment-attempts";
import { createServiceClient } from "@/lib/supabase/service";
import { fireTransfer, isStripeAccountPayoutReady } from "@/lib/stripe-connect";
import {
  fulfillPlacementPayment,
  firePendingPlacementPayouts,
} from "@/lib/placement-payouts";
import { notifyJobAwarded, notifyPaymentFailed } from "@/lib/notifications";
import {
  fulfillOrganisationCheckout,
  syncOrganisationSubscription,
} from "@/infrastructure/stripe/organisation-subscriptions";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      // Missing secret in production is a misconfiguration — reject everything
      // rather than silently accepting unverified events.
      console.error("STRIPE_WEBHOOK_SECRET is not set in production");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }
    // Dev/test only: allow without verification when CLI hasn't set the secret yet
    console.warn(
      "STRIPE_WEBHOOK_SECRET not set; skipping verification (dev only)",
    );
    return NextResponse.json({ received: true });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.metadata?.purpose === "organisation_subscription") {
          await fulfillOrganisationCheckout(session.id);
        } else if (session.metadata?.purpose === "placement_payment") {
          const paymentId = session.metadata.placement_payment_id;
          const piId =
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : null;
          if (paymentId) await fulfillPlacementPayment(paymentId, piId);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        if (subscription.metadata?.purpose === "organisation_subscription") {
          await syncOrganisationSubscription(subscription);
        }
        break;
      }

      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await finalizePaymentAttempt(pi.id);

        // Now that payment is confirmed, notify the kinglancer they got the job
        const kinglancerId = pi.metadata?.kinglancer_id;
        const jobId = pi.metadata?.job_id;
        if (kinglancerId && jobId) {
          const db = createServiceClient();
          const [{ data: profile }, { data: job }] = await Promise.all([
            db.from("profiles").select("email").eq("id", kinglancerId).single(),
            db.from("jobs").select("title").eq("id", jobId).single(),
          ]);
          if (profile?.email && job?.title) {
            notifyJobAwarded({
              kinglancerId,
              kinglancerEmail: profile.email,
              jobTitle: job.title,
            }).catch(() => {});
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const jobId = pi.metadata?.job_id;
        const clientId = pi.metadata?.client_id;

        console.error(
          `Payment failed for PaymentIntent ${pi.id}:`,
          pi.last_payment_error?.message,
        );

        if (!jobId) break;

        const db = createServiceClient();

        // Do not mutate jobs/applications here. A failed PaymentIntent can often
        // be retried with the same client secret, and the Kinglancer has not
        // been assigned until payment_intent.succeeded finalizes the attempt.
        const { data: failedJob } = await db
          .from("jobs")
          .select("title")
          .eq("id", jobId)
          .single();
        const jobTitle = failedJob?.title ?? "your job";

        // 5. Notify client — card declined, please retry
        if (clientId) {
          const { data: clientProfile } = await db
            .from("profiles")
            .select("email")
            .eq("id", clientId)
            .single();
          if (clientProfile?.email) {
            notifyPaymentFailed({
              role: "client",
              email: clientProfile.email,
              jobTitle,
            }).catch(() => {});
          }
        }

        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object;
        await updatePaymentAttemptStatus(pi.id, "cancelled").catch((err) =>
          console.error(
            `[webhook] Could not mark PaymentIntent ${pi.id} cancelled:`,
            err,
          ),
        );

        break;
      }

      // ── Stripe Connect: kinglancer completed onboarding ──
      case "account.updated": {
        const account = event.data.object;
        const payoutsEnabled = isStripeAccountPayoutReady(account);

        const db = createServiceClient();

        // Keep local payout status in sync with Stripe. A returned onboarding
        // flow can still be pending verification, so do not rely on
        // charges_enabled alone.
        const { data: profile } = await db
          .from("profiles")
          .update({ stripe_onboarding_complete: payoutsEnabled })
          .eq("stripe_account_id", account.id)
          .select("id")
          .single();

        if (!profile) break; // unknown account — ignore
        if (!payoutsEnabled) break;

        // Fire any released-but-untransferred transactions for this kinglancer
        const { data: pendingTx } = await db
          .from("transactions")
          .select(
            "id, job_id, amount, platform_fee_kinglancer, stripe_payment_intent_id",
          )
          .eq("kinglancer_id", profile.id)
          .eq("status", "released")
          .is("stripe_transfer_id", null);

        for (const tx of pendingTx ?? []) {
          const amountPence = Math.round(
            (tx.amount - tx.platform_fee_kinglancer) * 100,
          );
          await fireTransfer({
            transactionId: tx.id,
            amountPence,
            destinationAccountId: account.id,
            jobId: tx.job_id,
            paymentIntentId: tx.stripe_payment_intent_id ?? undefined,
          }).catch((err) =>
            console.error(`[webhook] Transfer failed for tx ${tx.id}:`, err),
          );
        }

        // Also release any funded-but-untransferred placement payments.
        await firePendingPlacementPayouts(profile.id).catch((err) =>
          console.error(`[webhook] Placement payouts failed:`, err),
        );
        break;
      }

      default:
        // Unhandled event type — not an error, just ignore
        break;
    }
  } catch (err) {
    console.error("Error handling webhook event:", err);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
