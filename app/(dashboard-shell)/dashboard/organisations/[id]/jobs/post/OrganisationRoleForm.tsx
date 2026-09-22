"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import LocationField from "@/components/jobs/LocationField";

export default function OrganisationRoleForm({
  organisationId,
}: {
  organisationId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [employmentType, setEmploymentType] = useState<"permanent" | "temporary">("permanent");
  const [payCadence, setPayCadence] = useState<"weekly" | "monthly">("monthly");
  const [payAmount, setPayAmount] = useState("");
  const [payNegotiable, setPayNegotiable] = useState(false);
  const [settlementMode, setSettlementMode] = useState<"managed" | "direct">("managed");
  const [workMode, setWorkMode] = useState<"online" | "in_person" | "hybrid">("online");
  const [addressLine, setAddressLine] = useState("");
  const [postcode, setPostcode] = useState("");
  const [daysOnSite, setDaysOnSite] = useState("2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleCategory(category: string) {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organisation_id: organisationId,
        posting_type: "role",
        title,
        description,
        categories,
        employment_type: employmentType,
        pay_cadence: payNegotiable ? null : payCadence,
        pay_amount: payNegotiable ? null : Number(payAmount),
        pay_negotiable: payNegotiable,
        settlement_mode: payNegotiable ? "direct" : settlementMode,
        work_mode: workMode,
        address_line: workMode === "online" ? null : addressLine,
        postcode: workMode === "online" ? null : postcode,
        days_on_site: workMode === "hybrid" ? Number(daysOnSite) : null,
      }),
    });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) {
      setError(data.error ?? "Could not post the role.");
      return;
    }
    router.push(`/dashboard/organisations/${organisationId}/jobs`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Role title *</label>
        <input required value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="e.g. Community Programme Coordinator" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">What will this person do? *</label>
        <textarea required minLength={10} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-32 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Describe the responsibilities, outcomes and experience needed." />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Category *</p>
        <div className="flex flex-wrap gap-2">
          {JOB_CATEGORIES.map((category) => (
            <button key={category} type="button" onClick={() => toggleCategory(category)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${categories.includes(category) ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600"}`}>
              {category}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">Role type
          <select value={employmentType} onChange={(event) => setEmploymentType(event.target.value as "permanent" | "temporary")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal">
            <option value="permanent">Permanent</option>
            <option value="temporary">Temporary</option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">Pay arrangement
          <select value={payNegotiable ? "discuss" : "set"} onChange={(event) => setPayNegotiable(event.target.value === "discuss")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal">
            <option value="set">Set recurring pay</option>
            <option value="discuss">Discuss at interview</option>
          </select>
        </label>
      </div>
      {!payNegotiable && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Pay per period (£) *
            <input required type="number" min="10" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal" />
          </label>
          <label className="text-sm font-semibold text-slate-700">Pay cadence
            <select value={payCadence} onChange={(event) => setPayCadence(event.target.value as "weekly" | "monthly")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal">
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
      )}
      {!payNegotiable && (
        <label className="text-sm font-semibold text-slate-700">Payment handling
          <select value={settlementMode} onChange={(event) => setSettlementMode(event.target.value as "managed" | "direct")} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal">
            <option value="managed">KingsHire-managed escrow and payout</option>
            <option value="direct">Organisation pays the Kinglancer directly</option>
          </select>
        </label>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Where is the role based?</p>
        <div className="flex overflow-hidden rounded-xl border border-slate-200 text-sm">
          {(["online", "hybrid", "in_person"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setWorkMode(mode)} className={`flex-1 px-3 py-2.5 capitalize ${workMode === mode ? "bg-blue-600 text-white" : "text-slate-600"}`}>{mode.replace("_", " ")}</button>
          ))}
        </div>
      </div>
      {workMode !== "online" && <LocationField addressLine={addressLine} postcode={postcode} onAddressLineChange={setAddressLine} onPostcodeChange={setPostcode} />}
      {workMode === "hybrid" && <label className="text-sm font-semibold text-slate-700">Days on-site per week<input required type="number" min="1" max="6" value={daysOnSite} onChange={(event) => setDaysOnSite(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal" /></label>}
      <button disabled={loading || categories.length === 0} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{loading ? "Posting role..." : "Post Organisation role"}</button>
    </form>
  );
}
