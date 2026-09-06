"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PAYOUT_PROVIDERS, payoutProviderLabel } from "@/lib/payout-links";

export default function PayoutAccountForm({
  provider: initialProvider,
  link: initialLink,
}: {
  provider: string | null;
  link: string | null;
}) {
  const router = useRouter();
  const [provider, setProvider] = useState(initialProvider ?? "revolut");
  const [link, setLink] = useState(initialLink ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const example =
    PAYOUT_PROVIDERS.find((p) => p.id === provider)?.example ?? "https://…";

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/profile/payout-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, link }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not save your payout link.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  async function remove() {
    setDeleting(true);
    setError(null);
    const res = await fetch("/api/profile/payout-account", {
      method: "DELETE",
    });
    setDeleting(false);
    if (!res.ok) {
      setError("Could not remove your payout link.");
      return;
    }
    setLink("");
    setSaved(false);
    router.refresh();
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">Payout details</h2>
      <p className="mt-1 text-sm text-slate-500">
        For jobs paid by bank transfer, we pay you via a link you control. Add
        your {payoutProviderLabel(provider)} link so we know where to send your
        money. You can change or remove it anytime.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {PAYOUT_PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder={example}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-sm font-semibold text-emerald-600">
          Payout link saved.
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving || deleting}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save payout link"}
        </button>
        {initialLink && (
          <button
            onClick={remove}
            disabled={saving || deleting}
            className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
    </div>
  );
}
