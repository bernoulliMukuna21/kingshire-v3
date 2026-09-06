"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";

export default function HideAgreementButton({
  agreementId,
}: {
  agreementId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function hide() {
    setBusy(true);
    const res = await fetch(`/api/placements/agreements/${agreementId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    });
    if (res.ok) {
      router.refresh();
    } else {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={hide}
      disabled={busy}
      title="Hide from your list"
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
    >
      <EyeOff size={13} />
      {busy ? "Hiding…" : "Hide"}
    </button>
  );
}
