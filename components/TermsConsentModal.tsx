"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Loader2 } from "lucide-react";

export default function TermsConsentModal() {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function accept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/terms/accept", { method: "POST" });
      if (!res.ok) {
        setError("Couldn't save that. Please try again.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-100 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <FileText size={20} />
        </div>
        <h2 className="text-xl font-black text-slate-950">
          We&apos;ve updated our terms
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          We&apos;ve refreshed how our platform fees work and want to be upfront
          about it. Please review and agree to keep using KingsHire.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          <li>
            • A clear breakdown of the platform fee on every job and placement.
          </li>
          <li>
            • What you see at checkout is what you pay — no hidden charges.
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-600">
          Read the full{" "}
          <Link
            href="/terms"
            target="_blank"
            className="font-bold text-blue-600 hover:underline"
          >
            Terms &amp; Conditions
          </Link>
          .
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            Read later
          </button>
          <button
            type="button"
            onClick={accept}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}I
            understand and agree
          </button>
        </div>
      </div>
    </div>
  );
}
