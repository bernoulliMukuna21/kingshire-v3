"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Briefcase } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/animations";

interface Kinglancer {
  id: string;
  full_name: string;
  avatar_url: string | null;
  skills: string[] | null;
  rating: number | null;
  jobs_completed: number;
}

export default function KinglancersGrid({
  kinglancers,
}: {
  kinglancers: Kinglancer[];
}) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? kinglancers.filter(
        (k) =>
          k.full_name.toLowerCase().includes(query.toLowerCase()) ||
          k.skills?.some((s) => s.toLowerCase().includes(query.toLowerCase())),
      )
    : kinglancers;

  return (
    <>
      {/* Search */}
      <div className="max-w-6xl mx-auto px-6 -mt-6 mb-8">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md pl-4 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all text-sm"
          placeholder="Filter by name or skill…"
        />
      </div>

      {/* Grid */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm py-12 text-center">
            No Kinglancers match &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <Stagger
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            staggerDelay={0.05}
          >
            {filtered.map((k) => {
              const initials = k.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              const primarySkill = k.skills?.[0] ?? "Kinglancer";

              return (
                <StaggerItem key={k.id}>
                  <Link href={`/kinglancers/${k.id}`}>
                    <div className="group bg-white rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50/60 transition-all duration-300 hover:-translate-y-0.5 overflow-hidden">
                      {/* Card body */}
                      <div className="p-5">
                        {/* Avatar + name row */}
                        <div className="flex items-center gap-3.5 mb-4">
                          <div className="w-12 h-12 rounded-xl bg-[#0f172a] flex items-center justify-center shrink-0 overflow-hidden">
                            {k.avatar_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={k.avatar_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-bold text-base tracking-wide">
                                {initials}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 truncate text-sm group-hover:text-blue-700 transition-colors">
                              {k.full_name}
                            </p>
                            <p className="text-blue-600 text-xs font-medium truncate">
                              {primarySkill}
                            </p>
                          </div>
                        </div>

                        {/* Skills */}
                        {(k.skills?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {k.skills!.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="bg-gray-50 border border-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-md"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Star
                              size={11}
                              className="text-yellow-400 fill-yellow-400"
                            />
                            <span className="font-semibold text-gray-700">
                              {k.jobs_completed > 0
                                ? Number(k.rating).toFixed(1)
                                : "New"}
                            </span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase size={11} />
                            {k.jobs_completed} jobs
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        )}
      </div>
    </>
  );
}
