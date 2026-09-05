"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MilestoneConfirmButton({
  agreementId,
  milestoneId,
}: {
  agreementId: string;
  milestoneId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const res = await fetch(
      `/api/placements/agreements/${agreementId}/milestones/${milestoneId}`,
      { method: "PATCH" },
    );
    setBusy(false);
    if (res.ok) router.refresh();
  }

  return (
    <button
      onClick={confirm}
      disabled={busy}
      className="shrink-0 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {busy ? "…" : "Confirm"}
    </button>
  );
}
