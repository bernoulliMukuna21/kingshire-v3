"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  SlidersHorizontal,
  Clock,
  Briefcase,
  CheckCircle,
  Star,
} from "lucide-react";
import { Stagger, StaggerItem } from "@/components/animations";
import type { JobWithClient } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function JobsList({
  jobs,
  appliedJobIds = [],
}: {
  jobs: JobWithClient[];
  appliedJobIds?: string[];
}) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = jobs.filter((j) => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      activeFilter === "All" || (j.categories ?? []).includes(activeFilter);
    return matchSearch && matchFilter;
  });

  return (
    <>
      {/* Search bar */}
      <div className="mb-6 flex gap-3">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-white bg-white/90 py-3 pl-10 pr-4 text-sm text-slate-950 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 placeholder:text-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search jobs..."
          />
        </div>
        <div
          aria-hidden="true"
          className="rounded-2xl border border-white bg-white/90 px-4 py-3 text-slate-400 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50"
        >
          <SlidersHorizontal size={16} />
        </div>
      </div>

      {/* Category filters */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        {["All", ...JOB_CATEGORIES].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`shrink-0 cursor-pointer rounded-2xl px-4 py-2 text-sm font-bold transition-all ${
              activeFilter === f
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/60 hover:text-blue-700"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <p className="text-sm text-slate-500">
          <span className="font-bold text-slate-950">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "job" : "jobs"} found
        </p>
      </div>

      {/* Job cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <Briefcase size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No jobs found</p>
          <p className="text-sm mt-1">Try a different search or filter.</p>
        </div>
      ) : (
        <Stagger
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
          staggerDelay={0.05}
        >
          {filtered.map((job) => (
            <StaggerItem key={job.id}>
              <Card interactive className="group relative p-6">
                <Link
                  href={`/jobs/${job.id}`}
                  aria-label={job.title}
                  className="absolute inset-0 z-0 rounded-[inherit]"
                />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-base font-black leading-snug text-slate-950 transition-colors group-hover:text-blue-700">
                      {job.title}
                    </h3>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="text-lg font-black text-green-600">
                      £{Number(job.budget).toLocaleString()}
                    </span>
                    {appliedJobIds.includes(job.id) && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                        <CheckCircle size={11} />
                        Applied
                      </span>
                    )}
                  </div>
                </div>

                {(job.categories ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.categories.map((s) => (
                      <span
                        key={s}
                        className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <div className="flex items-center gap-3">
                    {job.deadline && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(job.deadline).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                    )}
                    <span>{timeAgo(job.created_at)}</span>
                  </div>
                  <Link
                    href={`/clients/${job.client.id}`}
                    className="relative z-10 flex items-center gap-1.5 rounded-full px-1 py-0.5 transition-colors hover:text-blue-700"
                  >
                    <Avatar
                      name={job.client.full_name}
                      src={job.client.avatar_url}
                      className="h-5 w-5 rounded-full text-[10px]"
                    />
                    <span className="font-medium text-slate-500">
                      {job.client.full_name.split(" ")[0]}
                    </span>
                    {job.client.total_reviews > 0 ? (
                      <span className="flex items-center gap-0.5 text-slate-500">
                        <Star
                          size={11}
                          className="fill-yellow-400 text-yellow-400"
                        />
                        {Number(job.client.rating).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-400">· New</span>
                    )}
                  </Link>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
