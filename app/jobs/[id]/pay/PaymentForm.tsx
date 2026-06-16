"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  ExpressCheckoutElement,
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
  const [walletsVisible, setWalletsVisible] = useState(false);

  const returnUrl = `${window.location.origin}/jobs/${jobId}/pay/confirmed`;

  const confirmCurrentElementsPayment = async () => {
    if (!stripe || !elements) return { error: { message: "Payment is not ready yet." } };

    return stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setErrorMessage(null);

    const { error } = await confirmCurrentElementsPayment();

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
      <div className="space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Pay faster</p>
          <p className="mt-1 text-xs text-gray-500">
            Apple Pay and Google Pay appear automatically on supported devices and browsers.
          </p>
        </div>

        <div className={walletsVisible ? "block" : "hidden"}>
          <ExpressCheckoutElement
            options={{
              business: { name: "KingsHire" },
              buttonHeight: 48,
              buttonTheme: {
                applePay: "black",
                googlePay: "black",
              },
              buttonType: {
                applePay: "check-out",
                googlePay: "checkout",
              },
              layout: {
                maxColumns: 2,
                maxRows: 1,
                overflow: "auto",
              },
              paymentMethods: {
                applePay: "always",
                googlePay: "always",
              },
            }}
            onConfirm={async (event) => {
              if (!elements) {
                event.paymentFailed({
                  reason: "fail",
                  message: "Payment is not ready yet.",
                });
                return;
              }

              setProcessing(true);
              setErrorMessage(null);

              const { error: submitError } = await elements.submit();
              if (submitError) {
                const message =
                  submitError.message ?? "Could not prepare wallet payment.";
                setErrorMessage(message);
                setProcessing(false);
                event.paymentFailed({ reason: "fail", message });
                return;
              }

              const { error } = await confirmCurrentElementsPayment();
              if (error) {
                const message =
                  error.message ?? "Wallet payment failed. Please try again.";
                setErrorMessage(message);
                setProcessing(false);
                event.paymentFailed({ reason: "fail", message });
                return;
              }

              setSucceeded(true);
            }}
            onAvailablePaymentMethodsChange={(event) => {
              setWalletsVisible(Boolean(event.paymentMethods));
            }}
          />
        </div>
      </div>

      {walletsVisible && (
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wide text-gray-400">
            <span className="bg-white px-3">or pay by card</span>
          </div>
        </div>
      )}

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
