"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Clock, Briefcase } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/animations";
import type { JobWithClient } from "@/lib/db/jobs";
import { JOB_CATEGORIES } from "@/lib/job-categories";

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function JobsList({ jobs }: { jobs: JobWithClient[] }) {
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
      <div className="flex gap-3 mb-6">
        <div className="flex-1 relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-white/10 bg-white/10 backdrop-blur-sm text-white placeholder:text-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all text-sm"
            placeholder="Search jobs..."
          />
        </div>
        <button className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-white/70 transition-colors cursor-pointer">
          <SlidersHorizontal size={16} />
        </button>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap pt-6">
        {["All", ...JOB_CATEGORIES].map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeFilter === f
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Results header */}
      <div className="flex items-center justify-between mt-6 mb-4">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "job" : "jobs"} found
        </p>
      </div>

      {/* Job cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
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
              <Link href={`/jobs/${job.id}`}>
                <div className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-blue-200 transition-all duration-300 hover:-translate-y-0.5 cursor-pointer">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-blue-700 transition-colors">
                        {job.title}
                      </h3>
                    </div>
                    <span className="text-lg font-black text-green-600 shrink-0">
                      £{Number(job.budget).toLocaleString()}
                    </span>
                  </div>

                  {(job.categories ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {job.categories.map((s) => (
                        <span
                          key={s}
                          className="bg-blue-50 text-blue-600 text-xs font-medium px-2.5 py-1 rounded-lg"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-400 pt-3 border-t border-gray-50">
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
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold overflow-hidden">
                        {job.client.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={job.client.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          job.client.full_name[0]?.toUpperCase()
                        )}
                      </div>
                      <span>{job.client.full_name.split(" ")[0]}</span>
                      <span>· {timeAgo(job.created_at)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
