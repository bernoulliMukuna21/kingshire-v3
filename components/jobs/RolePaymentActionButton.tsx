"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function RolePaymentActionButton({
  organisationId,
  paymentId,
}: {
  organisationId: string;
  paymentId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/organisations/${organisationId}/role-payments/${paymentId}/confirm`;

  async function complete() {
    setBusy(true);
    setError(null);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "prepare" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Could not prepare card verification.");
      setBusy(false);
      return;
    }
    if (!data.completed) {
      const stripe = await stripePromise;
      if (!stripe || !data.clientSecret) {
        setError("Card verification is unavailable. Refresh and retry.");
        setBusy(false);
        return;
      }
      const result = await stripe.confirmCardPayment(data.clientSecret);
      if (result.error) {
        setError(result.error.message ?? "Card verification was not completed.");
        setBusy(false);
        return;
      }
      const reconcile = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile" }),
      });
      if (!reconcile.ok) {
        const failure = await reconcile.json().catch(() => ({}));
        setError(failure.error ?? "Payment succeeded but is still being reconciled.");
        setBusy(false);
        return;
      }
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="mt-1 text-right">
      <button
        type="button"
        onClick={complete}
        disabled={busy}
        className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Complete card verification"}
      </button>
      {error && <p className="mt-1 max-w-xs text-xs text-red-700">{error}</p>}
    </div>
  );
}
