"use client";
import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import { SUPPORT_EMAIL } from "@/lib/contact";
import {
  deriveEnquiryView,
  enquirySchema,
  type EnquiryTopic,
} from "@/lib/support/view";

export default function ContactForm({
  topic,
  sourcePath,
  reference = "",
}: {
  topic: EnquiryTopic;
  sourcePath: string;
  reference?: string;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState("");
  const submission = useRef<string | null>(null);
  const view = deriveEnquiryView(topic);
  const feedback = topic === "feedback";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    submission.current ??= crypto.randomUUID();
    const input = {
      id: submission.current,
      topic,
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      organisation: String(form.get("organisation") ?? ""),
      reference: String(form.get("reference") ?? ""),
      message: String(form.get("message") ?? ""),
      website: String(form.get("website") ?? ""),
      sourcePath,
    };
    const parsed = enquirySchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "We couldn’t send your message. Please try again.",
        );
      setReceipt(result.id);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Please try again or email our team.",
      );
    } finally {
      setBusy(false);
    }
  }
  const field =
    "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
  if (receipt)
    return (
      <section
        role="status"
        className="rounded-3xl border border-emerald-100 bg-emerald-50 p-8"
      >
        <CheckCircle2 className="text-emerald-600" size={32} />
        <h2 className="mt-5 text-2xl font-bold">
          {topic === "demo"
            ? "Demo request received"
            : feedback
              ? "Thanks for helping us improve"
              : "Message received"}
        </h2>
        <p className="mt-3 text-slate-600">{view.success}</p>
        <p className="mt-5 text-sm text-slate-500">
          Your reference: <strong>{receipt.slice(0, 8).toUpperCase()}</strong>
        </p>
        <Link
          href="/"
          className="mt-6 inline-block font-semibold text-blue-600"
        >
          Back to KingsHire →
        </Link>
      </section>
    );
  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8"
    >
      <h2 className="text-2xl font-bold">{view.label}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        {feedback
          ? "Tell us what you liked, what was difficult, or anything else you’d like to share. Your name and email are optional."
          : topic === "demo"
            ? "We’ll arrange a walkthrough of hiring and managing work with your team. Tell us your preferred days or times below."
            : "Tell us what happened and what you were trying to do. Our team will reply by email."}
      </p>
      <fieldset disabled={busy} className="mt-7 space-y-5 disabled:opacity-70">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            Your name{feedback ? " (optional)" : ""}
            <input
              name="name"
              autoComplete="name"
              maxLength={100}
              required={!feedback}
              className={field}
            />
          </label>
          <label className="block text-sm font-semibold">
            Email address{feedback ? " (optional)" : ""}
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required={!feedback}
              className={field}
            />
          </label>
        </div>
        {topic === "demo" && (
          <label className="block text-sm font-semibold">
            Organisation name (optional)
            <input
              name="organisation"
              autoComplete="organization"
              maxLength={160}
              className={field}
            />
          </label>
        )}
        {topic === "payment" && (
          <label className="block text-sm font-semibold">
            Job or payment reference (optional)
            <input
              name="reference"
              defaultValue={reference}
              maxLength={120}
              className={field}
            />
          </label>
        )}
        <label className="block text-sm font-semibold">
          {view.prompt}
          <textarea
            name="message"
            minLength={10}
            maxLength={5000}
            rows={6}
            required
            className={`${field} resize-y`}
          />
        </label>
        <div aria-hidden="true" className="absolute -left-[10000px]">
          <label>
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <p className="text-xs leading-5 text-slate-500">
          Please don’t include passwords, card numbers or bank details.{" "}
          {sourcePath &&
            "The page you came from will be included to help us understand your message. "}
          <Link href="/privacy" className="underline">
            How we use your information
          </Link>
        </p>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button
          disabled={busy}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
        >
          {busy ? (
            <>
              <LoaderCircle className="animate-spin" size={18} /> Sending…
            </>
          ) : (
            <>
              {topic === "demo"
                ? "Request a demo"
                : feedback
                  ? "Send feedback"
                  : "Send message"}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </fieldset>
      <p className="mt-5 text-sm text-slate-500">
        Prefer email?{" "}
        <a
          className="break-all font-medium text-blue-600"
          href={`mailto:${SUPPORT_EMAIL}`}
        >
          {SUPPORT_EMAIL}
        </a>
      </p>
    </form>
  );
}
