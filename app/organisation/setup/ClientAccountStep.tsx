"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, UserRound } from "lucide-react";
import OrganisationSetupShell from "@/components/organisations/OrganisationSetupShell";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function ClientAccountStep() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeAccount(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "client", phone }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Unable to complete your personal account.");
        return;
      }
      router.refresh();
    } catch {
      setError("Unable to save your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OrganisationSetupShell currentStep="account">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <UserRound size={23} />
        </div>
        <p className="mt-6 text-sm font-black uppercase tracking-[0.16em] text-blue-700">
          Personal Client account
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Complete the account that will own this Organisation
        </h1>
        <p className="mt-3 leading-7 text-slate-600">
          Your personal login keeps every Organisation action attributable and
          secure. You can invite colleagues after setup.
        </p>
        {error && (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}
        <form onSubmit={completeAccount} className="mt-7 space-y-5">
          <Field
            label="Phone number (optional)"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            help="Useful for account and work-related contact. You can add this later."
          />
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <ArrowRight size={18} />
            )}
            {loading ? "Saving account…" : "Continue to Organisation details"}
          </Button>
        </form>
      </div>
    </OrganisationSetupShell>
  );
}
