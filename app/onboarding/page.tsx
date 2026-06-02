"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

const roles = [
  {
    id: "client",
    title: "Client",
    subtitle: "I need work done",
    desc: "Post jobs and hire skilled people from your community.",
    emoji: "💼",
  },
  {
    id: "kinglancer",
    title: "Kinglancer",
    subtitle: "I offer my skills",
    desc: "Browse jobs and earn money from your skills.",
    emoji: "⚡",
  },
];

const skills = [
  "Web Design",
  "Photography",
  "Cleaning",
  "IT Support",
  "Graphic Design",
  "Plumbing",
  "Video Editing",
  "Tutoring",
  "Catering",
  "Social Media",
  "Carpentry",
  "Accounting",
  "Music Lessons",
  "Translation",
  "Driving",
  "Other",
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromParam = searchParams.get("from"); // "google" | "email" | null
  const roleParam = searchParams.get("role"); // "client" | "kinglancer" | null
  const nextParam = searchParams.get("next");

  const [role, setRole] = useState<string>("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [cvUrl, setCvUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load current profile role (pre-set when coming from Google sign-up)
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/sign-in");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (roleParam === "client" || roleParam === "kinglancer") {
        setRole(roleParam);
      } else if (profile?.role) {
        setRole(profile.role);
      }
      setInitialLoading(false);
    };
    loadProfile();
  }, [router, roleParam]);

  const toggleSkill = (skill: string) =>
    setSelectedSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill],
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!role) {
      setError("Please select a role.");
      return;
    }
    if (role === "kinglancer" && selectedSkills.length === 0) {
      setError("Please select at least one skill.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/profile/complete-onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        phone: phone || null,
        skills: selectedSkills,
        portfolio_url: portfolioUrl || null,
        cv_url: cvUrl || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    const safeNext = nextParam?.startsWith("/") ? nextParam : null;
    router.push(
      safeNext ??
        (role === "client" ? "/dashboard/client" : "/dashboard/kinglancer"),
    );
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={150}
            height={40}
            className="mx-auto mb-4"
            priority
          />
          <h1 className="text-2xl font-black text-gray-900 mb-1">
            {fromParam === "google"
              ? "Almost there!"
              : fromParam === "email"
                ? "Complete your profile"
                : "One last step"}
          </h1>
          <p className="text-gray-500 text-sm">
            {fromParam
              ? "Just a couple more details to complete your profile."
              : "How are you joining KingsHire?"}
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Only show role picker if not coming from sign-up (role already set) */}
          {!fromParam && (
            <div className="grid grid-cols-1 gap-3">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                    role === r.id
                      ? "border-blue-600 bg-blue-50 shadow-lg shadow-blue-100"
                      : "border-gray-200 bg-white hover:border-blue-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span className="text-3xl">{r.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-gray-900">{r.title}</p>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            role === r.id
                              ? "border-blue-600 bg-blue-600"
                              : "border-gray-300"
                          }`}
                        >
                          {role === r.id && (
                            <div className="w-2 h-2 bg-white rounded-full" />
                          )}
                        </div>
                      </div>
                      <p className="text-blue-600 text-sm font-medium mt-0.5">
                        {r.subtitle}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">{r.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Show the selected role as a read-only badge when coming from sign-up */}
          {fromParam && role && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <span className="text-2xl">
                {roles.find((r) => r.id === role)?.emoji}
              </span>
              <div>
                <p className="font-semibold text-gray-900">
                  {roles.find((r) => r.id === role)?.title}
                </p>
                <p className="text-sm text-gray-500">
                  {roles.find((r) => r.id === role)?.subtitle}
                </p>
              </div>
            </div>
          )}

          {/* Phone: only needed for Google flow (email flow collects it during sign-up) */}
          {fromParam !== "email" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Phone number{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all bg-white"
                placeholder="+44 7700 000000"
              />
            </div>
          )}

          {role === "kinglancer" && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Your skills{" "}
                <span className="text-gray-400 font-normal">
                  (select all that apply)
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedSkills.includes(skill)
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Portfolio & CV — kinglancers only */}
          {role === "kinglancer" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Portfolio or LinkedIn URL{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all bg-white"
                  placeholder="https://linkedin.com/in/yourname"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  CV link{" "}
                  <span className="text-gray-400 font-normal">
                    (Google Drive, Dropbox, etc. — optional)
                  </span>
                </label>
                <input
                  type="url"
                  value={cvUrl}
                  onChange={(e) => setCvUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all bg-white"
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading || !role}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:scale-100 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {loading ? "Setting up your account…" : "Complete setup"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 size={24} className="animate-spin text-blue-600" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
