"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import GoogleButton from "@/components/auth/GoogleButton";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
  normalizeEmail,
} from "@/lib/validation";

export default function SignUpPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleResend = async () => {
    setResendLoading(true);
    const supabase = createClient();
    await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(form.email),
    });
    setResendLoading(false);
    setResendSent(true);
  };

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !form.firstName ||
      !form.lastName ||
      !form.email ||
      !form.password ||
      !form.confirmPassword
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!isValidEmailAddress(form.email)) {
      setError(EMAIL_VALIDATION_MESSAGE);
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const email = normalizeEmail(form.email);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        data: {
          full_name: `${form.firstName} ${form.lastName}`,
          role: null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Supabase can intentionally return no error for existing users to prevent
    // account enumeration. In that case identities is empty.
    const emailAlreadyRegistered =
      !!data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    if (emailAlreadyRegistered) {
      setError(
        "This email is already registered. If you signed up with Google, use Continue with Google. Otherwise reset your password and sign in.",
      );
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, Supabase returns a session immediately
    if (data.session) {
      router.push("/onboarding");
      return;
    }

    // Otherwise show the "check your email" screen
    setLoading(false);
    setStep("verify");
  };

  return (
    <AuthLayout
      headline="Join your community."
      accent="Earn your worth."
      body="A trusted platform where church members hire and earn from each other."
      bullets={[
        "Free to join",
        "Payments protected by Stripe",
        "Community verified members",
        "5% platform fee only",
      ]}
    >
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {step === "details" ? (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-2xl font-black text-gray-900 mb-1">
                Create your account
              </h1>
              <p className="text-gray-500 mb-6 text-sm">
                Create your login first. You&apos;ll choose Client or
                Kinglancer in the next step.
              </p>

              <GoogleButton onClick={handleGoogleSignUp} />

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-sm text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {error && (
                <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                  {error}
                </div>
              )}

              <form onSubmit={handleEmailSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      First name
                    </label>
                    <input
                      value={form.firstName}
                      onChange={set("firstName")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                      placeholder="Jane"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                      Last name
                    </label>
                    <input
                      value={form.lastName}
                      onChange={set("lastName")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={set("email")}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
                    placeholder="Jane@example.com"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={set("password")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all pr-10"
                      placeholder="Min. 8 characters"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={set("confirmPassword")}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all pr-10"
                      placeholder="Repeat your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? "Creating account…" : "Create account"}
                </button>
                <p className="text-center text-xs text-gray-400 mt-1">
                  By creating an account you agree to our{" "}
                  <Link href="/terms" className="text-blue-600 hover:underline">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="text-blue-600 hover:underline"
                  >
                    Privacy Policy
                  </Link>
                </p>
              </form>
              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </motion.div>
          ) : (
            // Verify email step
            <motion.div
              key="verify"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={32} className="text-blue-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900 mb-2">
                Check your email
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                We sent a confirmation link to{" "}
                <span className="font-semibold text-gray-700">
                  {normalizeEmail(form.email)}
                </span>
                . Click the link to activate your account.
              </p>
              {resendSent ? (
                <p className="text-xs text-green-600 mb-3">Email resent!</p>
              ) : (
                <p className="text-xs text-gray-400 mb-3">
                  Didn&apos;t receive it?{" "}
                  <button
                    onClick={handleResend}
                    disabled={resendLoading}
                    className="text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {resendLoading ? "Sending…" : "Resend email"}
                  </button>
                </p>
              )}
              <p className="text-xs text-gray-400">
                Wrong email?{" "}
                <button
                  onClick={() => {
                    setStep("details");
                    setResendSent(false);
                  }}
                  className="text-blue-600 hover:underline"
                >
                  Go back
                </button>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AuthLayout>
  );
}
