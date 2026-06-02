import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { updateTransactionStatus } from "@/lib/db/transactions";
import { createServiceClient } from "@/lib/supabase/service";
import { fireTransfer } from "@/lib/stripe-connect";
import { notifyJobAwarded, notifyPaymentFailed } from "@/lib/notifications";

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
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        await updateTransactionStatus(pi.id, "held");

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
        const kinglancerId = pi.metadata?.kinglancer_id;
        const clientId = pi.metadata?.client_id;

        console.error(
          `Payment failed for PaymentIntent ${pi.id}:`,
          pi.last_payment_error?.message,
        );

        if (!jobId) break;

        const db = createServiceClient();

        // 1. Delete the pending transaction — no money was ever captured
        await db
          .from("transactions")
          .delete()
          .eq("stripe_payment_intent_id", pi.id);

        // 2. Reset job back to open and clear the kinglancer assignment
        await db
          .from("jobs")
          .update({ status: "open", kinglancer_id: null })
          .eq("id", jobId);

        // 3. Reset accepted/rejected applications to pending so the client can rehire.
        // selectApplicant() rejects other pending applicants before payment succeeds.
        await db
          .from("applications")
          .update({ status: "pending" })
          .eq("job_id", jobId)
          .in("status", ["accepted", "rejected"]);

        // 4. Fetch job title once for notifications
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

        // 6. Notify kinglancer — selection is on hold
        if (kinglancerId) {
          const { data: kinglancerProfile } = await db
            .from("profiles")
            .select("email")
            .eq("id", kinglancerId)
            .single();
          if (kinglancerProfile?.email) {
            notifyPaymentFailed({
              role: "kinglancer",
              email: kinglancerProfile.email,
              jobTitle,
            }).catch(() => {});
          }
        }

        break;
      }

      // ── Stripe Connect: kinglancer completed onboarding ──
      case "account.updated": {
        const account = event.data.object;
        if (!account.charges_enabled) break; // not fully verified yet

        const db = createServiceClient();

        // Mark kinglancer as onboarded
        const { data: profile } = await db
          .from("profiles")
          .update({ stripe_onboarding_complete: true })
          .eq("stripe_account_id", account.id)
          .select("id")
          .single();

        if (!profile) break; // unknown account — ignore

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
