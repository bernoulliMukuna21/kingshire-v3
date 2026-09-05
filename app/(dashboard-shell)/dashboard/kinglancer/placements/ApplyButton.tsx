"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import ConfirmModal from "@/components/ConfirmModal";

export default function ApplyButton({
  placementId,
  openToPlacements,
}: {
  placementId: string;
  openToPlacements: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  // Tracks in-session consent for a Kinglancer who had not opted in before.
  const [consented, setConsented] = useState(openToPlacements);
  const [message, setMessage] = useState("");
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Apply is opt-in: an un-opted-in Kinglancer sees the consent modal first;
  // confirming records consent and opens the application form.
  function startApply() {
    if (consented) {
      setOpen(true);
    } else {
      setConsentOpen(true);
    }
  }

  function confirmConsent() {
    setConsented(true);
    setConsentOpen(false);
    setOpen(true);
  }

  async function uploadCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("CV must be under 5MB.");
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setError("CV must be a PDF or Word document.");
      return;
    }
    setUploading(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Please sign in again to upload your CV.");
      setUploading(false);
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${placementId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("placement-cvs")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError("Failed to upload CV. Please try again.");
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage
      .from("placement-cvs")
      .getPublicUrl(path);
    setCvUrl(urlData.publicUrl);
    setCvName(file.name);
    setUploading(false);
  }

  async function apply() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/placements/${placementId}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        cvUrl,
        optIn: openToPlacements ? undefined : consented,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      // 409 means an application already exists — treat it as applied.
      if (res.status === 409) {
        setApplied(true);
        setOpen(false);
        router.refresh();
        return;
      }
      const data = await res.json().catch(() => ({}));
      // Consent drifted (e.g. opt-in cleared elsewhere) — re-capture it.
      if (res.status === 403 && data.error === "opt_in_required") {
        setConsented(false);
        setOpen(false);
        setConsentOpen(true);
        return;
      }
      setError(data.error ?? "Could not apply.");
      return;
    }
    setApplied(true);
    setOpen(false);
    router.refresh();
  }

  if (applied) {
    return (
      <span className="inline-flex items-center gap-1 text-sm font-bold text-emerald-700">
        ✓ Application sent
      </span>
    );
  }

  if (!open) {
    return (
      <>
        <button
          onClick={startApply}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Apply
        </button>
        <ConfirmModal
          isOpen={consentOpen}
          onClose={() => setConsentOpen(false)}
          onConfirm={confirmConsent}
          title="Opt in to placements"
          confirmLabel="I understand — continue"
          message={
            <span className="space-y-2 text-sm text-slate-600">
              <span className="block">
                Placements are supervised experience opportunities. The value
                you receive is whatever the Organisation has explicitly agreed
                and recorded — this may include mentoring, training,
                certification, expenses or pay, and is not a promise of paid
                work.
              </span>
              <span className="block">
                Continuing turns on <strong>Open to placements</strong> on your
                profile so you can apply. You can switch it off anytime in your
                profile. See our{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  terms
                </Link>{" "}
                for details.
              </span>
            </span>
          }
        />
      </>
    );
  }

  return (
    <div className="w-full space-y-3">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={5}
        maxLength={2000}
        placeholder="Introduce yourself and say why you'd be a great fit (optional)."
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={uploadCv}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {uploading
            ? "Uploading…"
            : cvName
              ? "Replace CV"
              : "Attach CV (optional)"}
        </button>
        {cvName && (
          <p className="mt-1.5 text-xs text-slate-500">
            Attached: <span className="font-semibold">{cvName}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400">PDF or Word, up to 5MB.</p>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={apply}
          disabled={saving || uploading}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Sending…" : "Send application"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
