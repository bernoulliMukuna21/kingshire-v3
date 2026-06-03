"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(
        "Failed to update password. The link may have expired — request a new one.",
      );
      setLoading(false);
      return;
    }

    // Sign out so they sign in fresh with the new password
    await supabase.auth.signOut();
    router.push("/sign-in?success=password_reset");
  };

  return (
    <AuthLayout
      headline="Set a new password."
      accent="Almost done."
      body="Choose a strong password for your KingsHire account."
    >
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-black text-gray-900 mb-1">
          Create new password
        </h1>
        <p className="text-gray-500 mb-8 text-sm">
          Must be at least 8 characters.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}{" "}
            {error.includes("expired") && (
              <a href="/forgot-password" className="underline font-medium">
                Request a new link
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
              New password
            </label>
            <div className="relative">
              <Field
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
              />
            </div>
          </div>
          <Field
            label="Confirm new password"
            type={showPassword ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat your password"
            required
          />
          <Button
            type="submit"
            disabled={loading}
            className="mt-2 w-full"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Updating password…" : "Update password"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
