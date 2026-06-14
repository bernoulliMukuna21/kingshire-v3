"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="text-6xl font-black text-[#10234b] mb-4">500</p>
        <h1 className="text-2xl font-black text-slate-950 mb-2">
          Something went wrong
        </h1>
        <p className="text-slate-500 mb-8">
          An unexpected error occurred. Please try again — if the problem
          persists, contact us at{" "}
          <a
            href="mailto:kingshirecompany@gmail.com"
            className="text-blue-600 underline"
          >
            kingshirecompany@gmail.com
          </a>
          .
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center rounded-2xl bg-[#10234b] px-6 py-3 text-sm font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[#1a3a6e]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
