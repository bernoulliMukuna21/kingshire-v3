"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses } from "@/components/ui/Field";

type Organisation = {
  id: string;
  name: string;
  organisation_type: string;
  email: string;
  website: string | null;
  location: string | null;
  country: string;
  registration_number: string | null;
  description: string | null;
};

export default function OrganisationSettings({
  organisation,
  canDelete,
}: {
  organisation: Organisation;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  async function save(formData: FormData) {
    setMessage(null);
    const response = await fetch(`/api/organisations/${organisation.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    setMessage(response.ok ? "Organisation profile saved." : result.error);
    if (response.ok) router.refresh();
  }

  async function remove() {
    if (!window.confirm(`Delete ${organisation.name}? Historical financial records will be retained.`)) return;
    const response = await fetch(`/api/organisations/${organisation.id}`, { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error);
      return;
    }
    router.push("/dashboard/organisations");
    router.refresh();
  }

  return (
    <form action={save} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Name" defaultValue={organisation.name} required />
        <Field name="email" label="Organisation email" type="email" defaultValue={organisation.email} required />
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-slate-700">Type</span>
          <select name="organisation_type" className={fieldClasses} defaultValue={organisation.organisation_type}>
            <option value="company">Company</option>
            <option value="charity">Charity</option>
            <option value="church">Church or ministry</option>
            <option value="non_profit">Non-profit</option>
            <option value="community_group">Community group</option>
            <option value="public_body">Public body</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field name="website" label="Website" type="url" defaultValue={organisation.website ?? ""} />
        <Field name="location" label="Location" defaultValue={organisation.location ?? ""} />
        <Field name="country" label="Country" defaultValue={organisation.country} />
        <Field name="registration_number" label="Registration number" defaultValue={organisation.registration_number ?? ""} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-bold text-slate-700">Description</span>
        <textarea name="description" rows={4} maxLength={1000} defaultValue={organisation.description ?? ""} className={fieldClasses} />
      </label>
      {message && <p className="text-sm text-slate-600">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit">Save profile</Button>
        {canDelete && <Button type="button" variant="danger" onClick={remove}>Delete Organisation</Button>}
      </div>
    </form>
  );
}
