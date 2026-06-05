"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackButton() {
  return (
    <Link
      href="/jobs"
      className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-sm mb-5 transition-colors"
    >
      <ArrowLeft size={15} />
      Back to jobs
    </Link>
  );
}
