"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Clock, CheckCircle2 } from "lucide-react";
import { useAsyncAction } from "@/lib/hooks/useAsyncAction";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type ReviewData = {
  rating: number;
  comment: string | null;
};

type MyReview = ReviewData & { is_published: boolean };

export type ReviewPanelProps = {
  jobId: string;
  /** First name of the counterparty being reviewed / who reviews you. */
  counterpartName: string;
  /** The role of the counterparty, for copy ("kinglancer" | "client"). */
  counterpartRole: "client" | "kinglancer";
  myReview: MyReview | null;
  counterpartReview: ReviewData | null;
  /** True once the 7-day review window has elapsed. */
  windowClosed: boolean;
  /** Time-left label for the open window, e.g. "4 days left". */
  remaining?: { label: string; urgent: boolean } | null;
};

function StarsDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={16}
          className={
            n <= value
              ? "fill-yellow-400 text-yellow-400"
              : "fill-slate-200 text-slate-200"
          }
        />
      ))}
    </div>
  );
}

function StarInput({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:cursor-not-allowed"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            size={28}
            className={cn(
              "transition-colors",
              n <= active
                ? "fill-yellow-400 text-yellow-400"
                : "fill-slate-100 text-slate-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewQuote({
  heading,
  data,
  emptyLabel,
}: {
  heading: string;
  data: ReviewData | null;
  emptyLabel?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        {heading}
      </p>
      {data ? (
        <>
          <div className="mt-2">
            <StarsDisplay value={data.rating} />
          </div>
          {data.comment && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              “{data.comment}”
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          {emptyLabel ?? "No review left."}
        </p>
      )}
    </div>
  );
}

export default function ReviewPanel({
  jobId,
  counterpartName,
  counterpartRole,
  myReview,
  counterpartReview,
  windowClosed,
  remaining,
}: ReviewPanelProps) {
  const router = useRouter();
  const { loading, error, setError, run } = useAsyncAction();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const roleLabel = counterpartRole === "kinglancer" ? "Kinglancer" : "client";

  // ── Already submitted ────────────────────────────────────
  if (myReview) {
    const revealed = myReview.is_published;
    return (
      <div className="space-y-4">
        {revealed ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CheckCircle2 size={16} />
            Reviews are now public
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl bg-blue-50 p-3 text-sm text-blue-800">
            <Clock size={16} className="mt-0.5 shrink-0" />
            <span>
              Thanks for your review! It stays hidden until {counterpartName}{" "}
              reviews you too, or the 7-day window closes — keeping feedback
              honest on both sides.
            </span>
          </div>
        )}

        <ReviewQuote
          heading={`Your review of ${counterpartName}`}
          data={myReview}
        />

        {revealed && (
          <ReviewQuote
            heading={`${counterpartName}'s review of you`}
            data={counterpartReview}
            emptyLabel={`${counterpartName} didn't leave a review in time.`}
          />
        )}
      </div>
    );
  }

  // ── Window closed without a submission ───────────────────
  if (windowClosed) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
          <Clock size={16} className="mt-0.5 shrink-0 text-slate-400" />
          <span>The 7-day review window for this job has closed.</span>
        </div>
        {counterpartReview && (
          <ReviewQuote
            heading={`${counterpartName}'s review of you`}
            data={counterpartReview}
          />
        )}
      </div>
    );
  }

  // ── Submission form ──────────────────────────────────────
  const submit = () =>
    run(async () => {
      if (rating < 1) {
        setError("Please select a star rating.");
        return;
      }
      const res = await fetch(`/api/jobs/${jobId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not save your review.");
        return;
      }
      router.refresh();
    });

  return (
    <div className="space-y-4">
      {remaining && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold",
            remaining.urgent
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-700",
          )}
        >
          <Clock size={16} className="shrink-0" />
          <span>
            {remaining.urgent ? "Last chance — " : ""}
            {remaining.label} to leave your review
          </span>
        </div>
      )}

      <p className="text-sm text-slate-500">
        How was working with {counterpartName}? Your review stays hidden until
        the {roleLabel} reviews you too, or the 7-day window closes.
      </p>

      <div>
        <p className="mb-1.5 text-sm font-bold text-slate-700">
          Rating <span className="text-red-500">*</span>
        </p>
        <StarInput value={rating} onChange={setRating} disabled={loading} />
      </div>

      <div>
        <label
          htmlFor="review-comment"
          className="mb-1.5 block text-sm font-bold text-slate-700"
        >
          Comment <span className="font-medium text-slate-400">(optional)</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={loading}
          rows={4}
          maxLength={2000}
          placeholder={`Share what it was like working with ${counterpartName}…`}
          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm text-slate-950 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      <Button onClick={submit} disabled={loading}>
        {loading ? "Submitting…" : "Submit review"}
      </Button>
    </div>
  );
}
