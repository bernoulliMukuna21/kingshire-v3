"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses } from "@/components/ui/Field";

export default function OrganisationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  function requestConfirmation(formData: FormData) {
    setError(null);
    setPendingFormData(formData);
  }

  async function createOrganisation() {
    if (!pendingFormData) return;
    setLoading(true);
    setError(null);
    const response = await fetch("/api/organisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(pendingFormData.entries())),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to create Organisation.");
      return;
    }
    setPendingFormData(null);
    router.push(`/dashboard/organisations/${result.id}`);
    router.refresh();
  }

  return (
    <form action={requestConfirmation} className="space-y-5">
      {error && pendingFormData === null && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <Field name="name" label="Organisation name" required maxLength={120} />

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
        <div className="mb-3 flex items-start gap-3">
          <span className="rounded-xl bg-white p-2 text-blue-700 shadow-sm">
            <Building2 size={20} />
          </span>
          <div>
            <label
              htmlFor="organisation_type"
              className="block text-sm font-bold text-slate-900"
            >
              What kind of Organisation is this?
            </label>
            <p className="mt-0.5 text-xs leading-5 text-slate-600">
              This helps people understand who is offering the opportunity.
            </p>
          </div>
        </div>
        <select
          id="organisation_type"
          name="organisation_type"
          className={fieldClasses}
          defaultValue="company"
        >
          <option value="company">Company</option>
          <option value="charity">Charity</option>
          <option value="church">Church or ministry</option>
          <option value="non_profit">Non-profit</option>
          <option value="community_group">Community group</option>
          <option value="public_body">Public body</option>
          <option value="other">Other</option>
        </select>
      </div>

      <Field name="website" label="Website (optional)" type="url" />
      <Field name="location" label="Location (optional)" />
      <Field name="country" label="Country" defaultValue="United Kingdom" />
      <div>
        <Field
          name="registration_number"
          label="Official registration number (optional)"
        />
        <p className="mt-1.5 text-xs leading-5 text-slate-500">
          Use a Companies House, Charity Commission or other official register
          number. You can add this later.
        </p>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">
          Description (optional)
        </span>
        <textarea
          name="description"
          maxLength={1000}
          rows={5}
          className={fieldClasses}
        />
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        Create Organisation
      </Button>

      <ConfirmModal
        isOpen={pendingFormData !== null}
        onClose={() => !loading && setPendingFormData(null)}
        onConfirm={createOrganisation}
        title="Create this Organisation?"
        message="You will become its Owner with full control. Check the details before creating the workspace."
        confirmLabel="Create Organisation"
        loading={loading}
        error={error ?? undefined}
      />
    </form>
  );
}
