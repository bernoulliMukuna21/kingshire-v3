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
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setInvitationUrl(null);
    setSentEmail(null);
    setCopied(false);
    setError(null);
    const email = String(formData.get("email") ?? "").trim();
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
    setSentEmail(email);
    router.refresh();
  }

  async function copyLink() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; the link is still selectable.
    }
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
        <div className="sm:col-span-3 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-bold text-green-800">
            Invitation sent{sentEmail ? ` to ${sentEmail}` : ""}.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Didn&apos;t arrive? Share this link so they can join:
          </p>
          <div className="mt-1 flex gap-2">
            <input
              readOnly
              value={invitationUrl}
              onFocus={(event) => event.currentTarget.select()}
              className={fieldClasses}
            />
            <button
              type="button"
              onClick={copyLink}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
