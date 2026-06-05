"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Loader2, Lock, CheckCircle } from "lucide-react";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

// ── Inner form (must be inside <Elements>) ────────────────

function CheckoutForm({ jobId }: { jobId: string }) {
  const stripe = useStripe();
  const elements = useElements();

  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/jobs/${jobId}/pay/confirmed`,
      },
    });

    // Only reached if there is an immediate error (card declined, etc.)
    // On success, Stripe redirects to return_url
    if (error) {
      setErrorMessage(
        error.message ?? "Payment failed. Please try a different card.",
      );
      setProcessing(false);
    } else {
      setSucceeded(true);
    }
  };

  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <CheckCircle size={40} className="text-green-500" />
        <p className="font-semibold text-gray-900">Payment confirmed!</p>
        <p className="text-sm text-gray-500">Redirecting...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <PaymentElement />

      {errorMessage && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full py-3.5 bg-[#1a2e5a] hover:bg-[#1e3a7a] text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg"
      >
        {processing ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Lock size={15} />
            Pay securely
          </>
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        Powered by Stripe · Your card details are never stored on our servers
      </p>
    </form>
  );
}

// ── Outer wrapper (provides Elements context) ─────────────

export default function PaymentForm({
  clientSecret,
  jobId,
}: {
  clientSecret: string;
  jobId: string;
  jobTitle: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#1a2e5a",
              borderRadius: "12px",
              fontFamily: "inherit",
            },
          },
        }}
      >
        <CheckoutForm jobId={jobId} />
      </Elements>
    </div>
  );
}
