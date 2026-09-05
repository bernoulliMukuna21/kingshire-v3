"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function BillingPortalButton({
  organisationId,
}: {
  organisationId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/stripe/organisation-billing-portal",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organisation_id: organisationId }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.url) {
        setError(result.error ?? "Unable to manage subscription.");
        return;
      }
      window.location.assign(result.url);
    } catch {
      setError("Unable to reach Stripe. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button type="button" onClick={openPortal} disabled={loading}>
        {loading ? (
          <Loader2 size={17} className="animate-spin" />
        ) : (
          <CreditCard size={17} />
        )}
        Manage subscription
      </Button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
