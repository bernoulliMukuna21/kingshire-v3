"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, fieldClasses } from "@/components/ui/Field";

export default function InviteMemberForm({
  organisationId,
  canInviteAdmin,
}: {
  organisationId: string;
  canInviteAdmin: boolean;
}) {
  const router = useRouter();
  const [invitationUrl, setInvitationUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setInvitationUrl(null);
    setError(null);
    const response = await fetch(`/api/organisations/${organisationId}/invitations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error ?? "Unable to create invitation.");
      return;
    }
    setInvitationUrl(result.invitation_url);
    router.refresh();
  }

  return (
    <form action={submit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
      <Field name="email" type="email" placeholder="colleague@example.com" required />
      <select name="role" className={fieldClasses} defaultValue="member">
        <option value="member">Member</option>
        {canInviteAdmin && <option value="admin">Admin</option>}
      </select>
      <Button type="submit">Invite</Button>
      {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
      {invitationUrl && (
        <div className="sm:col-span-3">
          <p className="mb-1 text-xs font-bold text-green-700">
            Invitation created. Copy and send this link:
          </p>
          <input readOnly value={invitationUrl} onFocus={(event) => event.currentTarget.select()} className={fieldClasses} />
        </div>
      )}
    </form>
  );
}
