"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Briefcase } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/animations";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";

interface Kinglancer {
  id: string;
  full_name: string;
  avatar_url: string | null;
  service_tags: string[] | null;
  tagline: string | null;
  services: Array<{ name: string; rate: number; rate_type: string }> | null;
  rating: number | null;
  jobs_completed: number;
}

function getProfileHeadline(kinglancer: Kinglancer) {
  const serviceNames =
    kinglancer.services
      ?.map((service) => service.name)
      .filter((name) => name.trim().length > 0) ?? [];

  return (
    kinglancer.tagline || serviceNames.slice(0, 2).join(" · ") || "Kinglancer"
  );
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
          k.tagline?.toLowerCase().includes(query.toLowerCase()) ||
          k.service_tags?.some((s) =>
            s.toLowerCase().includes(query.toLowerCase()),
          ) ||
          k.services?.some((service) =>
            service.name.toLowerCase().includes(query.toLowerCase()),
          ),
      )
    : kinglancers;

  return (
    <>
      {/* Search */}
      <div className="mx-auto mb-8 max-w-6xl px-4 pt-10 sm:px-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full max-w-md rounded-2xl border border-white bg-white/90 px-4 py-3 text-sm text-slate-950 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 placeholder:text-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Filter by name or service…"
        />
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
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
              const headline = getProfileHeadline(k);

              return (
                <StaggerItem key={k.id}>
                  <Link href={`/kinglancers/${k.id}`}>
                    <Card interactive className="group overflow-hidden">
                      {/* Card body */}
                      <div className="p-5">
                        {/* Avatar + name row */}
                        <div className="flex items-center gap-3.5 mb-4">
                          <Avatar
                            name={k.full_name}
                            src={k.avatar_url}
                            className="h-12 w-12"
                            tone="green"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-950 transition-colors group-hover:text-blue-700">
                              {k.full_name}
                            </p>
                            <p className="truncate text-xs font-bold text-blue-700">
                              {headline}
                            </p>
                          </div>
                        </div>

                        {/* Service tags */}
                        {(k.service_tags?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-4">
                            {k.service_tags!.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="rounded-full border border-slate-100 bg-slate-50 px-2 py-0.5 text-xs text-slate-600"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Stats */}
                        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Star
                              size={11}
                              className="text-yellow-400 fill-yellow-400"
                            />
                            <span className="font-bold text-slate-700">
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
                    </Card>
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
