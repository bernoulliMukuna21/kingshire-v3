"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses } from "@/components/ui/Field";

export default function OrganisationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setLoading(true);
    setError(null);
    const response = await fetch("/api/organisations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to create Organisation.");
      return;
    }
    router.push(`/dashboard/organisations/${result.id}`);
    router.refresh();
  }

  return (
    <form action={submit} className="space-y-5">
      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <Field name="name" label="Organisation name" required maxLength={120} />
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">Organisation type</span>
        <select name="organisation_type" className={fieldClasses} defaultValue="company">
          <option value="company">Company</option>
          <option value="charity">Charity</option>
          <option value="church">Church or ministry</option>
          <option value="non_profit">Non-profit</option>
          <option value="community_group">Community group</option>
          <option value="public_body">Public body</option>
          <option value="other">Other</option>
        </select>
      </label>
      <Field name="email" label="Organisation email" type="email" required />
      <Field name="website" label="Website (optional)" type="url" />
      <Field name="location" label="Location (optional)" />
      <Field name="country" label="Country" defaultValue="United Kingdom" />
      <Field name="registration_number" label="Registration number (optional)" />
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">Description (optional)</span>
        <textarea name="description" maxLength={1000} rows={5} className={fieldClasses} />
      </label>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating Organisation…" : "Create Organisation"}
      </Button>
    </form>
  );
}
