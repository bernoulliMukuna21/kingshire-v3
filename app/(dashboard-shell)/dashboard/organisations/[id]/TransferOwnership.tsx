"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { fieldClasses } from "@/components/ui/Field";
import ConfirmModal from "@/components/ConfirmModal";

export default function TransferOwnership({
  organisationId,
  members,
}: {
  organisationId: string;
  members: Array<{ userId: string; name: string }>;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedName = members.find((member) => member.userId === userId)?.name;

  async function transfer() {
    setLoading(true);
    setError(null);
    const response = await fetch(`/api/organisations/${organisationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "transfer_ownership", user_id: userId }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(result.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select value={userId} onChange={(event) => setUserId(event.target.value)} className={fieldClasses}>
        <option value="">Select new Owner</option>
        {members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
      </select>
      <Button
        type="button"
        variant="secondary"
        disabled={!userId}
        onClick={() => setConfirming(true)}
      >
        Transfer ownership
      </Button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
      <ConfirmModal
        isOpen={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={transfer}
        title="Transfer ownership?"
        message={
          <>
            {selectedName ? `${selectedName} ` : "This member "}
            will become the Owner of this Organisation and you will become an
            Admin. This can only be undone by the new Owner.
          </>
        }
        confirmLabel="Transfer ownership"
        loading={loading}
        variant="danger"
        error={error ?? undefined}
      />
    </div>
  );
}
