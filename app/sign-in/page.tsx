"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import GoogleButton from "@/components/auth/GoogleButton";
import KingsChatButton from "@/components/auth/KingsChatButton";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { getRoleHome } from "@/lib/roles";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
  normalizeEmail,
} from "@/lib/validation";

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");
  const authReason = searchParams.get("reason");
  const authSuccess = searchParams.get("success");
  const requestedNext = searchParams.get("next");
  const requestedRole = searchParams.get("role");
  const intent = searchParams.get("intent");
  const safeNext =
    requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : null;

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    const callbackParams = new URLSearchParams();
    if (safeNext) callbackParams.set("next", safeNext);
    if (requestedRole === "client" || requestedRole === "kinglancer") {
      callbackParams.set("role", requestedRole);
    }
    if (intent === "organisation") callbackParams.set("intent", intent);
    const callbackUrl = `${window.location.origin}/auth/callback${
      callbackParams.size ? `?${callbackParams.toString()}` : ""
    }`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidEmailAddress(email)) {
      setError(EMAIL_VALIDATION_MESSAGE);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const normalizedEmail = normalizeEmail(email);
    const { data, error: signInError } = await supabase.auth.signInWithPassword(
      { email: normalizedEmail, password },
    );

    if (signInError || !data.user) {
      // "invalid_credentials" covers both wrong password and Google-SSO-only accounts.
      // Supabase intentionally can't distinguish them (anti-enumeration). Hint at both.
      const isCredentialsError =
        !signInError ||
        signInError.message.toLowerCase().includes("invalid") ||
        signInError.message.toLowerCase().includes("credentials");
      setError(
        isCredentialsError
          ? "Invalid email or password. If you signed up with Google or KingsChat, use that same option to sign in instead."
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(
      profile?.role
        ? (safeNext ?? getRoleHome(profile.role))
        : `/onboarding?${new URLSearchParams({
            ...(safeNext ? { next: safeNext } : {}),
            ...(requestedRole === "client" || requestedRole === "kinglancer"
              ? { role: requestedRole }
              : {}),
            ...(intent === "organisation" ? { intent } : {}),
          }).toString()}`,
    );
  };

  return (
    <AuthLayout
      headline="Welcome back."
      accent="Great to see you."
      body="Your community is waiting. Sign in and get to work."
    >
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft size={14} /> Back to home
        </Link>

        <h1 className="text-2xl font-black text-gray-900 mb-1">
          Sign in to KingsHire
        </h1>
        <p className="text-gray-500 mb-8 text-sm">Enter your details below.</p>

        <GoogleButton onClick={handleGoogleSignIn} showDivider={false} />
        <KingsChatButton
          next={
            intent === "organisation"
              ? "/organisation/start"
              : safeNext ?? undefined
          }
        />

        {authSuccess === "password_reset" && (
          <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            Password updated successfully. Sign in with your new password.
          </div>
        )}

        {(error || authError === "auth_failed") && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error ??
              (authReason === "email_unverified"
                ? "Your KingsChat email isn't verified. Verify it in KingsChat, or sign in with Google or your password instead."
                : "Authentication failed. Please try signing in again.")}
          </div>
        )}

        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <Field
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@example.com"
            required
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-gray-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs text-blue-600 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Field
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
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
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link
            href={`/sign-up${safeNext ? `?next=${encodeURIComponent(safeNext)}` : ""}`}
            className="text-blue-600 font-semibold hover:underline"
          >
            Create one free
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
