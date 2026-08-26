"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Lock, Rocket, Trash2, RotateCcw } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import type { PlacementActionSpec } from "@/lib/placements";

const ICONS = {
  rocket: Rocket,
  lock: Lock,
  trash: Trash2,
  repost: RotateCcw,
} as const;

const TONES = {
  primary:
    "bg-blue-600 text-white shadow-sm shadow-blue-500/25 hover:bg-blue-700",
  neutral: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
} as const;

const btn =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50";

export default function PlacementActions({
  organisationId,
  placementId,
  actions,
}: {
  organisationId: string;
  placementId: string;
  actions: PlacementActionSpec[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<PlacementActionSpec | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function execute(spec: PlacementActionSpec) {
    setBusy(spec.kind);
    setError(null);
    const url = `/api/organisations/${organisationId}/placements/${placementId}`;
    try {
      if (spec.kind === "delete") {
        const res = await fetch(url, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Could not delete this placement.");
          return;
        }
        setConfirming(null);
        router.push(`/dashboard/organisations/${organisationId}/placements`);
        router.refresh();
        return;
      }
      const action = spec.kind === "publish" ? "publish" : "cancel";
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setConfirming(null);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!actions.length) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3">
      {error && <span className="text-xs text-red-600">{error}</span>}
      {actions.map((spec) => {
        const Icon = ICONS[spec.icon];
        if (spec.kind === "repost") {
          return (
            <Link
              key={spec.kind}
              href={`/dashboard/organisations/${organisationId}/placements/new?from=${placementId}`}
              className={`${btn} ${TONES[spec.tone]}`}
            >
              <Icon size={15} />
              {spec.label}
            </Link>
          );
        }
        return (
          <button
            key={spec.kind}
            onClick={() => (spec.confirm ? setConfirming(spec) : execute(spec))}
            disabled={busy !== null}
            className={`${btn} ${TONES[spec.tone]}`}
          >
            <Icon size={15} />
            {busy === spec.kind ? "Working…" : spec.label}
          </button>
        );
      })}

      <ConfirmModal
        isOpen={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => confirming && execute(confirming)}
        title={confirming?.confirm?.title ?? ""}
        message={
          confirming?.confirm ? (
            <>
              {confirming.confirm.bullets && (
                <ul className="list-disc space-y-1.5 pl-5">
                  {confirming.confirm.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              )}
              {confirming.confirm.note && (
                <p className="mt-2.5 text-slate-600">
                  {confirming.confirm.note}
                </p>
              )}
            </>
          ) : null
        }
        confirmLabel={confirming?.confirm?.confirmLabel ?? "Confirm"}
        loading={busy !== null}
        variant={confirming?.confirm?.danger ? "danger" : "primary"}
        error={error ?? undefined}
      />
    </div>
  );
}
