"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function AcceptInvitationButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function accept() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/organisation-invitations/${token}/accept`, { method: "POST" });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error ?? "Unable to accept invitation.");
      return;
    }
    router.push(`/dashboard/organisations/${result.organisation_id}`);
    router.refresh();
  }
  return (
    <div>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Button onClick={accept} disabled={loading}>{loading ? "Joining…" : "Accept invitation"}</Button>
    </div>
  );
}
