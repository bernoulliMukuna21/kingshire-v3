"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import ConfirmModal from "@/components/ConfirmModal";

export default function SwitchRoleButton({
  currentRole,
}: {
  currentRole: string | null;
}) {
  const router = useRouter();
  const { loading, error, setError, run } = useAsyncAction();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const target = currentRole === "client" ? "Kinglancer" : "Client";
  const fromLabel = currentRole === "client" ? "Client" : "Kinglancer";

  const handleConfirm = () =>
    run(async () => {
      setConfirmOpen(false);
      const res = await fetch("/api/profile/switch-role", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        if (data.requires_setup && data.redirect) {
          router.push(data.redirect);
          return;
        }
        setError(data.error ?? "Failed to switch role");
        return;
      }
      router.push(data.redirect);
      router.refresh();
    });

  return (
    <div>
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={`Switch to ${target}?`}
        message={
          <>
            You are currently a <strong>{fromLabel}</strong>. Switching will
            move you to the {target} dashboard. You can switch back at any time
            from Settings.
          </>
        }
        confirmLabel={`Switch to ${target}`}
        loading={loading}
      />
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Switch to {target}
      </button>
      {error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
    </div>
  );
}
