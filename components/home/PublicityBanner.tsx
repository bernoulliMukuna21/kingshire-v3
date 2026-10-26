"use client";
import Link from "next/link";
import { Pause, Play, Sparkles } from "lucide-react";
import { useState } from "react";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";
import {
  deriveHomeNews,
  homeAudience,
  type HomeProgress,
} from "@/lib/home-news";
export default function PublicityBanner({
  progress,
}: {
  progress: HomeProgress;
}) {
  const auth = usePublicAuth();
  const [paused, setPaused] = useState(false);
  const stories = deriveHomeNews(progress, homeAudience(auth));
  if (!stories.length)
    return (
      <div aria-hidden="true" className="relative z-20 h-12 bg-blue-700/60" />
    );
  return (
    <aside
      aria-label="KingsHire community news"
      className="relative z-20 flex min-h-12 items-center gap-3 border-b border-white/15 bg-linear-to-r from-blue-700 via-indigo-600 to-cyan-500 px-3 text-white sm:px-6"
    >
      <div className="flex shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wider">
        <Sparkles size={17} aria-hidden="true" />
        <span className="hidden sm:inline">Worth celebrating</span>
      </div>
      <div
        className="news-window min-w-0 flex-1 overflow-hidden"
        role="region"
        aria-label="Community milestones"
      >
        <div
          className="news-track flex w-max"
          style={{
            animationPlayState: paused ? "paused" : "running",
            animationDuration: `${Math.max(30, stories.reduce((total, story) => total + story.text.length, 0) / 7)}s`,
          }}
        >
          {[false, true].map((duplicate) => (
            <div
              key={String(duplicate)}
              aria-hidden={duplicate || undefined}
              className={`flex shrink-0 items-center gap-10 py-3 pr-10 ${duplicate ? "news-copy" : ""}`}
            >
              {stories.map((story) => (
                <Link
                  key={story.id}
                  href={story.href}
                  tabIndex={duplicate ? -1 : undefined}
                  aria-label={`${story.text} ${story.linkLabel}`}
                  className="inline-flex items-center gap-3 whitespace-nowrap rounded text-sm font-medium text-white/95 outline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-white"
                >
                  <span aria-hidden="true" className="text-cyan-200">
                    ✦
                  </span>
                  {story.text}
                  <span className="text-xs font-bold underline underline-offset-4">
                    {story.linkLabel} →
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPaused((value) => !value)}
        aria-label={paused ? "Play community news" : "Pause community news"}
        aria-pressed={paused}
        className="hidden min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-white/15 p-2 hover:bg-white/25 [@media(hover:none)]:flex"
      >
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
    </aside>
  );
}
