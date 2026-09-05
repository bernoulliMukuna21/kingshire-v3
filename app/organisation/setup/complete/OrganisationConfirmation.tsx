"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

const AUTOMATIC_RETRIES = 4;

export default function OrganisationConfirmation({
  sessionId,
}: {
  sessionId: string;
}) {
  const router = useRouter();
  const attempts = useRef(0);
  const [state, setState] = useState<"confirming" | "delayed">("confirming");
  const [message, setMessage] = useState(
    "Stripe has returned you safely. We are activating your workspace now.",
  );

  const confirm = useCallback(async () => {
    setState("confirming");
    while (attempts.current <= AUTOMATIC_RETRIES) {
      try {
        const response = await fetch("/api/organisations/setup/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });
        const result = await response.json();

        if (response.ok && result.organisation_id) {
          window.sessionStorage.removeItem("kingshire-organisation-setup");
          router.replace(
            `/organisation/setup/team?organisation_id=${result.organisation_id}`,
          );
          return;
        }

        const retryable = response.status >= 500 || result.retryable;
        if (!retryable) {
          setMessage(
            result.error ??
              "Confirmation is taking longer than expected. Your setup details are safe.",
          );
          setState("delayed");
          return;
        }
      } catch {
        // A transient network or Stripe error follows the same bounded retry
        // path as a retryable server response.
      }

      attempts.current += 1;
      if (attempts.current <= AUTOMATIC_RETRIES) {
        setMessage("Finishing your Organisation setup…");
        await new Promise((resolve) =>
          window.setTimeout(resolve, attempts.current * 1200),
        );
      }
    }

    setMessage(
      "Stripe confirmation is temporarily unavailable. Your payment is safe; retry in a moment.",
    );
    setState("delayed");
  }, [router, sessionId]);

  useEffect(() => {
    const initialConfirmation = window.setTimeout(() => void confirm(), 0);
    return () => window.clearTimeout(initialConfirmation);
  }, [confirm]);

  return (
    <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        {state === "confirming" ? (
          <Loader2 size={30} className="animate-spin" />
        ) : (
          <CheckCircle2 size={30} />
        )}
      </div>
      <h1 className="mt-6 text-3xl font-black text-slate-950">
        {state === "confirming"
          ? "Finishing your Organisation"
          : "Confirmation is taking a little longer"}
      </h1>
      <p className="mt-3 leading-7 text-slate-600">{message}</p>
      {state === "delayed" && (
        <Button
          type="button"
          size="lg"
          className="mt-7"
          onClick={() => {
            attempts.current = 0;
            void confirm();
          }}
        >
          <RefreshCw size={18} /> Try confirmation again
        </Button>
      )}
    </div>
  );
}
