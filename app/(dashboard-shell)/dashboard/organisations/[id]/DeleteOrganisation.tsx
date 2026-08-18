"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export default function DeleteOrganisation({
  organisationId,
  organisationName,
}: {
  organisationId: string;
  organisationName: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !window.confirm(
        `Delete ${organisationName}? Historical financial records will be retained.`,
      )
    ) {
      return;
    }
    const response = await fetch(`/api/organisations/${organisationId}`, {
      method: "DELETE",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Could not delete the Organisation.");
      return;
    }
    router.push("/dashboard/organisations");
    router.refresh();
  }

  return (
    <div>
      <p className="mb-3 text-sm text-slate-600">
        Deleting the Organisation removes the workspace for everyone. Historical
        financial records are retained.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Button type="button" variant="danger" onClick={remove}>
        Delete Organisation
      </Button>
    </div>
  );
}
