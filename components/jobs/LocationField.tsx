"use client";

import { useState } from "react";

// Address + postcode capture with a live public-area preview (postcodes.io).
// The parent owns the values; the server re-derives area + geocode authoritatively.
export default function LocationField({
  addressLine,
  postcode,
  onAddressLineChange,
  onPostcodeChange,
  errorAddress,
  errorPostcode,
}: {
  addressLine: string;
  postcode: string;
  onAddressLineChange: (value: string) => void;
  onPostcodeChange: (value: string) => void;
  errorAddress?: string;
  errorPostcode?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function checkPostcode(raw: string) {
    const trimmed = raw.trim();
    setNotFound(false);
    setPreview(null);
    if (!trimmed) return;
    try {
      const res = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const body = await res.json();
      const r = body?.result;
      if (r?.postcode && r?.admin_district) {
        setPreview(`${r.admin_district} ${r.postcode.split(" ")[0]}`);
      } else {
        setNotFound(true);
      }
    } catch {
      // Network hiccup — the server validates on submit anyway.
    }
  }

  const inputClass = (hasError?: string) =>
    `w-full rounded-xl border px-4 py-2.5 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 ${
      hasError
        ? "border-red-400 focus:ring-red-300"
        : "border-gray-200 focus:ring-blue-500"
    }`;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Address <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={addressLine}
          maxLength={200}
          onChange={(e) => onAddressLineChange(e.target.value)}
          className={inputClass(errorAddress)}
          placeholder="Street address, building or site"
        />
        {errorAddress && (
          <p className="mt-1 text-xs text-red-500">{errorAddress}</p>
        )}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Postcode <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={postcode}
          maxLength={12}
          onChange={(e) => onPostcodeChange(e.target.value)}
          onBlur={(e) => checkPostcode(e.target.value)}
          className={inputClass(errorPostcode)}
          placeholder="e.g. S60 1AB"
        />
        {errorPostcode ? (
          <p className="mt-1 text-xs text-red-500">{errorPostcode}</p>
        ) : notFound ? (
          <p className="mt-1 text-xs text-amber-600">
            We couldn&apos;t find that postcode — double-check it.
          </p>
        ) : preview ? (
          <p className="mt-1 text-xs text-emerald-600">
            ✓ {preview} shown publicly. The full address is only shared with the
            Kinglancer you hire.
          </p>
        ) : (
          <p className="mt-1 text-xs text-gray-400">
            Only the area is public — the exact address is shared once you hire.
          </p>
        )}
      </div>
    </div>
  );
}
