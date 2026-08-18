"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Briefcase, GraduationCap } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";

export default function PostMenu({
  organisationId,
  canCreatePlacement,
}: {
  organisationId: string;
  canCreatePlacement: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const base = `/dashboard/organisations/${organisationId}`;

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={buttonClasses()}
      >
        Post
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          <Link
            role="menuitem"
            href={`${base}/jobs/post`}
            onClick={() => setOpen(false)}
            className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
          >
            <Briefcase className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <span>
              <span className="block text-sm font-bold text-slate-950">Post a job</span>
              <span className="block text-xs text-slate-500">
                Paid work — a Kinglancer is selected and paid through Kingshire.
              </span>
            </span>
          </Link>
          {canCreatePlacement && (
            <Link
              role="menuitem"
              href={`${base}/placements/new`}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <span className="block text-sm font-bold text-slate-950">Create a placement</span>
                <span className="block text-xs text-slate-500">
                  Supervised experience — no platform payment, just the value you offer.
                </span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
