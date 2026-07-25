"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";

export default function TransferOwnership({
  organisationId,
  members,
}: {
  organisationId: string;
  members: Array<{ userId: string; name: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function transfer() {
    if (!userId || !window.confirm("Transfer ownership? You will become an Admin.")) return;
    const response = await fetch(`/api/organisations/${organisationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer_ownership", user_id: userId }),
    });
    const result = await response.json();
    if (!response.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={userId} onChange={(event) => setUserId(event.target.value)} className={fieldClasses}>
        <option value="">Select new Owner</option>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
      </select>
      <Button type="button" variant="secondary" onClick={transfer}>Transfer ownership</Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </div>
  );
}
