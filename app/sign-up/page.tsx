"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import AuthLayout from "@/components/auth/AuthLayout";
import GoogleButton from "@/components/auth/GoogleButton";
import KingsChatButton from "@/components/auth/KingsChatButton";
import { AUTH_WORK_PLACEHOLDER } from "@/lib/image-placeholders";
import {
  EMAIL_VALIDATION_MESSAGE,
  isValidEmailAddress,
  normalizeEmail,
} from "@/lib/validation";

const KINGLANCER_AUTH_IMAGES = [
  {
    src: "/images/auth/kinglancer-laptop.jpg",
    alt: "An independent professional working on a laptop",
  },
  {
    src: "/images/auth/kinglancer-craft.jpg",
    alt: "A craftsperson working with tools",
  },
] as const;

const CLIENT_AUTH_IMAGES = [
  {
    src: "/images/auth/client-handshake.jpg",
    alt: "Two people beginning a working relationship",
  },
  {
    src: "/images/auth/client-planning.jpg",
    alt: "A person planning work using coloured notes",
  },
] as const;

const GENERAL_AUTH_IMAGES = [
  {
    src: "/images/auth/general-workspace.jpg",
    alt: "A person working independently",
  },
  {
    src: "/images/auth/general-practical-work.jpg",
    alt: "A practical worker carrying out their trade",
  },
] as const;

function SignUpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent");
  const requestedRole = searchParams.get("role");
  const isOrganisationJourney = intent === "organisation";
  // Organisation founders always start from a personal Client foundation.
  // A role query parameter is deliberately ignored for this journey; existing
  // authenticated Kinglancers keep their role and enter through /organisation/start.
  const onboardingRole =
    isOrganisationJourney || requestedRole === "client"
      ? "client"
      : requestedRole === "kinglancer"
        ? "kinglancer"
        : null;
  const journey = isOrganisationJourney
    ? "organisation"
    : onboardingRole === "kinglancer"
      ? "kinglancer"
      : onboardingRole === "client"
        ? "client"
        : "general";
  const requestedNext = searchParams.get("next");
  const safeNext = isOrganisationJourney
    ? "/organisation/setup"
    : requestedNext?.startsWith("/") && !requestedNext.startsWith("//")
      ? requestedNext
      : null;
  const callbackParams = new URLSearchParams();
  if (isOrganisationJourney) {
    callbackParams.set("intent", "organisation");
  } else {
    if (safeNext) callbackParams.set("next", safeNext);
    if (onboardingRole) callbackParams.set("role", onboardingRole);
  }
  const callbackPath = `/auth/callback${
    callbackParams.size ? `?${callbackParams.toString()}` : ""
  }`;
  const onboardingParams = new URLSearchParams();
  if (!isOrganisationJourney) {
    if (safeNext) onboardingParams.set("next", safeNext);
    if (onboardingRole) onboardingParams.set("role", onboardingRole);
  }
  const onboardingPath = isOrganisationJourney
    ? "/organisation/setup"
    : `/onboarding${
        onboardingParams.size ? `?${onboardingParams.toString()}` : ""
      }`;
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
      options: {
        emailRedirectTo: `${window.location.origin}${callbackPath}`,
      },
    });
    setResendLoading(false);
    setResendSent(true);
  };

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${callbackPath}`,
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
        emailRedirectTo: `${window.location.origin}${callbackPath}`,
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
        "This email is already registered. If you signed up with Google or KingsChat, use that same option to sign in. Otherwise reset your password and sign in.",
      );
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, Supabase returns a session immediately
    if (data.session) {
      router.push(onboardingPath);
      return;
    }

    // Otherwise show the "check your email" screen
    setLoading(false);
    setStep("verify");
  };

  return (
    <AuthLayout
      organisationSetup={isOrganisationJourney}
      imagePlaceholder={AUTH_WORK_PLACEHOLDER}
      headline={
        journey === "organisation"
          ? "Bring your team to KingsHire."
          : journey === "kinglancer"
            ? "Put your skills to work."
            : journey === "client"
              ? "Get the work done."
              : "Join your community."
      }
      accent={
        journey === "organisation"
          ? "Create opportunities together."
          : journey === "kinglancer"
            ? "Earn your worth."
            : journey === "client"
              ? "Hire with confidence."
              : "Earn your worth."
      }
      body={
        journey === "organisation"
          ? "Create a shared workspace for your Organisation while keeping every team action secure and accountable."
          : journey === "kinglancer"
            ? "Show people what you do, discover local opportunities and get paid securely for your work."
            : journey === "client"
              ? "Find trusted people for practical, creative and professional work."
              : "A trusted platform where people hire local talent and earn from their services."
      }
      bullets={
        journey === "organisation"
          ? [
              "Publish as your Organisation",
              "Invite your team",
              "Control member permissions",
              "Manage jobs together",
            ]
          : journey === "kinglancer"
            ? [
                "Build your service profile",
                "Discover local paid work",
                "Payments protected by Stripe",
                "Keep control of your availability",
              ]
            : journey === "client"
              ? [
                  "Post jobs clearly",
                  "Compare applicants",
                  "Payments protected by Stripe",
                  "Manage work in one place",
                ]
              : [
                  "Free to join",
                  "Payments protected by Stripe",
                  "Community verified members",
                  "Low platform fees (2.5% client / 5% kinglancer)",
                ]
      }
      images={
        journey === "organisation"
          ? undefined
          : journey === "kinglancer"
            ? KINGLANCER_AUTH_IMAGES
            : journey === "client"
              ? CLIENT_AUTH_IMAGES
              : GENERAL_AUTH_IMAGES
      }
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
                {isOrganisationJourney
                  ? "Create your Organisation"
                  : "Create your account"}
              </h1>
              <p className="text-gray-500 mb-6 text-sm">
                {isOrganisationJourney
                  ? "First, create your personal Client account. You’ll then create your Organisation, become its Owner and invite your team."
                  : onboardingRole
                    ? `First, create your secure personal ${onboardingRole === "client" ? "Client" : "Kinglancer"} account.`
                    : "Create your login first. You’ll choose Client or Kinglancer in the next step."}
              </p>

              <GoogleButton onClick={handleGoogleSignUp} showDivider={false} />
              <KingsChatButton
                label="Sign up with KingsChat"
                next={
                  isOrganisationJourney
                    ? "/organisation/start"
                    : (safeNext ?? undefined)
                }
              />

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
                  {loading
                    ? "Creating account…"
                    : isOrganisationJourney
                      ? "Continue to Organisation setup"
                      : "Create account"}
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
              {(journey === "client" || journey === "kinglancer") && (
                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm text-slate-600">
                  <span className="mr-2">Looking for a different setup?</span>
                  {journey === "client" ? (
                    <Link
                      href="/sign-up?role=kinglancer"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Become a Kinglancer
                    </Link>
                  ) : (
                    <Link
                      href="/sign-up?role=client"
                      className="font-bold text-blue-600 hover:underline"
                    >
                      Join as a Client
                    </Link>
                  )}
                  <span className="mx-2 text-slate-300">·</span>
                  <Link
                    href="/sign-up?intent=organisation"
                    className="font-bold text-blue-600 hover:underline"
                  >
                    Set up an Organisation
                  </Link>
                </div>
              )}
              <p className="text-center text-sm text-gray-500 mt-6">
                Already have an account?{" "}
                <Link
                  href={`/sign-in?${callbackParams.toString()}`}
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

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpContent />
    </Suspense>
  );
}
