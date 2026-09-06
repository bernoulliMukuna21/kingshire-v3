"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

export default function ApplicantActions({
  organisationId,
  placementId,
  applicationId,
  kinglancerId,
  fullName,
  avatarUrl,
  location,
}: {
  organisationId: string;
  placementId: string;
  applicationId: string;
  kinglancerId: string;
  fullName: string | null;
  avatarUrl: string | null;
  location: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsPayment, setNeedsPayment] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [accepted, setAccepted] = useState(false);

  async function run(action: "accept" | "reject") {
    setBusy(action);
    setError(null);
    setNeedsPayment(false);
    // Optimistically show the offer as sent — accept is fast (no Stripe call).
    if (action === "accept") setAccepted(true);
    const res = await fetch(
      `/api/organisations/${organisationId}/placements/${placementId}/applications/${applicationId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      // 402 = the org has no reusable card yet; offer a route to fix it.
      setNeedsPayment(res.status === 402);
      setAccepted(false);
      setBusy(null);
      return;
    }
    // Keep the busy/accepted state until the refresh removes this applicant
    // from the list (avoids the row flicking back mid-update).
    router.refresh();
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/organisation-billing-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation_id: organisationId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError(data.error ?? "Unable to reach Stripe. Please try again.");
    } catch {
      setError("Unable to reach Stripe. Please try again.");
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/kinglancers/${kinglancerId}`}
          className="flex min-w-0 items-center gap-3 hover:underline"
        >
          <Avatar
            name={fullName ?? undefined}
            src={avatarUrl ?? undefined}
            className="h-9 w-9"
          />
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-950">
              {fullName ?? "Kinglancer"}
            </p>
            {location && (
              <p className="truncate text-xs text-slate-500">{location}</p>
            )}
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          {accepted ? (
            <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
              Selected ✓
            </span>
          ) : (
            <>
              <button
                onClick={() => run("accept")}
                disabled={busy !== null}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy === "accept" ? "Accepting…" : "Accept"}
              </button>
              <button
                onClick={() => run("reject")}
                disabled={busy !== null}
                className="rounded-xl px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                Reject
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-xs ${
            needsPayment
              ? "border-amber-200 bg-amber-50 text-amber-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          <p className="font-semibold leading-relaxed">{error}</p>
          {needsPayment && (
            <button
              type="button"
              onClick={openBillingPortal}
              disabled={portalLoading}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {portalLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <CreditCard size={14} />
              )}
              Set up payment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
