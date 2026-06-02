"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SwitchRoleButton({
  currentRole,
}: {
  currentRole: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSwitch() {
    setLoading(true);
    setError("");
    try {
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
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const target = currentRole === "client" ? "Kinglancer" : "Client";

  return (
    <div>
      <button
        onClick={handleSwitch}
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
