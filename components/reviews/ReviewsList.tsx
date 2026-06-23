import { Star } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { PublicReview } from "@/lib/db/reviews";

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
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

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Renders published reviews about a user. Shows a friendly "New to KingsHire"
 * empty state instead of a bare zero when there are no reviews yet.
 */
export default function ReviewsList({
  reviews,
  emptyName = "This member",
}: {
  reviews: PublicReview[];
  emptyName?: string;
}) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
        <p className="text-sm font-bold text-slate-700">New to KingsHire</p>
        <p className="mt-1 text-sm text-slate-500">
          {emptyName} hasn&apos;t received any reviews yet. Be the first to work
          with them.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {reviews.map((review) => (
        <li
          key={review.id}
          className="rounded-2xl border border-slate-100 bg-white p-4"
        >
          <div className="flex items-start gap-3">
            <Avatar
              name={review.reviewer?.full_name}
              src={review.reviewer?.avatar_url}
              className="h-9 w-9 text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-slate-950">
                  {review.reviewer?.full_name ?? "KingsHire member"}
                </p>
                <span className="text-xs text-slate-400">
                  {formatDate(review.created_at)}
                </span>
              </div>
              <div className="mt-1">
                <Stars value={review.rating} />
              </div>
              {review.comment && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {review.comment}
                </p>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
