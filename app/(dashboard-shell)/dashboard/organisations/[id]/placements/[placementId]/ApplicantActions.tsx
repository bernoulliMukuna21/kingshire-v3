"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ApplicantActions({
  organisationId,
  placementId,
  applicationId,
}: {
  organisationId: string;
  placementId: string;
  applicationId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "accept" | "reject") {
    setBusy(action);
    setError(null);
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
      setBusy(null);
      return;
    }
    // Keep the busy state until the refresh removes this applicant from the
    // list (avoids the button flicking back to 'Accept' mid-update).
    router.refresh();
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error && <span className="text-xs text-red-600">{error}</span>}
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
    </div>
  );
}
