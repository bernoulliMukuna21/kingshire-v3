"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTransition, useRef } from "react";
import { Search, X } from "lucide-react";

export default function KinglancersSearch({
  defaultValue,
}: {
  defaultValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function navigate(q: string) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    startTransition(() => {
      router.push(q ? `${pathname}?${params}` : pathname);
    });
  }

  return (
    <div className="mx-auto mb-8 max-w-6xl px-4 pt-10 sm:px-6">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(inputRef.current?.value.trim() ?? "");
        }}
        className="relative max-w-md"
      >
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          ref={inputRef}
          name="q"
          defaultValue={defaultValue}
          placeholder="Search by name or service…"
          className="w-full rounded-2xl border border-white bg-white/90 py-3 pl-9 pr-10 text-sm text-slate-950 shadow-xl shadow-slate-900/5 ring-1 ring-slate-200/50 placeholder:text-slate-400 transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
          disabled={isPending}
        />
        {defaultValue && (
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              navigate("");
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        )}
      </form>
      {isPending && <p className="mt-2 text-xs text-slate-400">Searching…</p>}
    </div>
  );
}
