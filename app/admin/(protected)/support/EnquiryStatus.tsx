"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  deriveEnquiryView,
  enquiryStatuses,
  type EnquiryStatus as Status,
} from "@/lib/support/view";
export default function EnquiryStatus({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function change(next: Status) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/support/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, expectedStatus: status }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Couldn’t update this enquiry.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500">
        Status
        <select
          aria-label="Enquiry status"
          disabled={busy}
          value={status}
          onChange={(e) => change(e.target.value as Status)}
          className="ml-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
        >
          {enquiryStatuses.map((value) => (
            <option key={value} value={value}>
              {deriveEnquiryView("account", value).statusLabel}
            </option>
          ))}
        </select>
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
