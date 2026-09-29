"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";

export function ApplyForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [coverLetter, setCoverLetter] = useState("");
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvName, setCvName] = useState<string | null>(null);
  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { loading, error, setError, run } = useAsyncAction();

  async function uploadCv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCvError("CV must be under 5MB.");
      return;
    }
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setCvError("CV must be a PDF or Word document.");
      return;
    }
    setUploadingCv(true);
    setCvError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setCvError("Please sign in again to upload your CV.");
      setUploadingCv(false);
      return;
    }
    const ext = file.name.split(".").pop();
    const path = `${user.id}/${jobId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("job-application-cvs")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setCvError("Failed to upload CV. Please try again.");
      setUploadingCv(false);
      return;
    }
    setCvPath(path);
    setCvName(file.name);
    setUploadingCv(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (coverLetter.trim().length < 20) {
      setError("Please write at least a couple of sentences.");
      return;
    }
    if (!cvPath) {
      setError("Please attach your CV to apply.");
      return;
    }

    run(async () => {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          cover_letter: coverLetter,
          cv_path: cvPath,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === "PROFILE_INCOMPLETE") {
          setError("PROFILE_INCOMPLETE");
        } else {
          setError(data.error ?? "Failed to submit. Please try again.");
        }
        return;
      }

      setDone(true);
      router.refresh();
    });
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl p-5">
        <CheckCircle size={20} className="text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-green-800">Application submitted!</p>
          <p className="text-green-700 text-sm mt-0.5">
            The client will review your application and get in touch if
            selected.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Your message to the client
        </label>
        <textarea
          value={coverLetter}
          onChange={(e) => setCoverLetter(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all resize-none"
          placeholder="Introduce yourself and explain why you're a great fit for this job..."
        />
        <p className="text-xs text-gray-400 mt-1 text-right">
          {coverLetter.length}/1000
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          CV <span className="text-red-500">*</span>
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          onChange={uploadCv}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingCv}
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploadingCv ? "Uploading…" : cvName ? "Replace CV" : "Attach CV"}
        </button>
        {cvName && (
          <p className="mt-1.5 text-xs text-gray-500">
            Attached: <span className="font-semibold">{cvName}</span>
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">PDF or Word, up to 5MB.</p>
        {cvError && <p className="mt-1 text-xs text-red-600">{cvError}</p>}
      </div>

      {error === "PROFILE_INCOMPLETE" ? (
        <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>
            Your profile is incomplete.{" "}
            <Link
              href="/dashboard/profile"
              className="font-bold underline underline-offset-2 hover:text-red-800"
            >
              Add an &lsquo;About you&rsquo; section and a service rate
            </Link>{" "}
            before applying.
          </span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" />
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading || uploadingCv}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all hover:scale-[1.01] shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Submitting...
          </>
        ) : (
          "Apply for this job"
        )}
      </button>
    </form>
  );
}
