"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useSearchParams } from "next/navigation";

export default function BackButton() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref");

  const href =
    ref === "dashboard"
      ? "/dashboard/kinglancer"
      : ref === "client-jobs"
        ? "/dashboard/client/jobs"
        : "/jobs";

  const label =
    ref === "dashboard"
      ? "Back to dashboard"
      : ref === "client-jobs"
        ? "Back to my jobs"
        : "Back to jobs";

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm mb-5 transition-colors"
    >
      <ArrowLeft size={15} />
      {label}
    </Link>
  );
}
