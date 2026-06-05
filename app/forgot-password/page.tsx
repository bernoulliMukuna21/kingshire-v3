"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
  normalizeEmail,
} from "@/lib/validation";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmailAddress(email)) {
      setError(EMAIL_VALIDATION_MESSAGE);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const normalizedEmail = normalizeEmail(email);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      },
    );

    if (resetError) {
      setError("Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    setLoading(false);
    setSent(true);
  };

  return (
    <AuthLayout
      headline="Reset your password."
      accent="We've got you."
      body="Enter your email and we'll send you a link to set a new password."
    >
      <div className="w-full max-w-md">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to sign in
        </Link>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-blue-600" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">
              Check your email
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              We sent a password reset link to{" "}
              <span className="font-semibold text-gray-700">
                {normalizeEmail(email)}
              </span>
              . Click the link to set a new password.
            </p>
            <p className="text-xs text-gray-400">
              Wrong email?{" "}
              <button
                onClick={() => setSent(false)}
                className="text-blue-600 hover:underline"
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black text-gray-900 mb-1">
              Forgot your password?
            </h1>
            <p className="text-gray-500 mb-8 text-sm">
              Enter your email and we&apos;ll send you a reset link.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Sending…" : "Send reset link"}
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
