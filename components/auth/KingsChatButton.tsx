"use client";

import Image from "next/image";

interface KingsChatButtonProps {
  label?: string;
  next?: string;
}

export default function KingsChatButton({
  label = "Continue with KingsChat",
  next,
}: KingsChatButtonProps) {
  const href = next
    ? `/api/auth/kingschat?next=${encodeURIComponent(next)}`
    : "/api/auth/kingschat";

  return (
    <>
      {/* KingsChat button — full-width, matches Google button style */}
      {/* Must be a plain <a> (full navigation), not <Link>. <Link> does a client-side
          fetch which triggers CORS when our API route redirects to accounts.kingschat.online */}
      <a
        href={href}
        className="w-full flex items-center justify-center gap-3 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium text-sm hover:bg-gray-50 hover:border-gray-300 transition-all hover:scale-[1.01] mb-3 bg-white shadow-sm"
      >
        <Image
          src="/kingschat-logo.png"
          alt="KingsChat"
          width={20}
          height={20}
          className="shrink-0"
        />
        {label}
      </a>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400">or</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
    </>
  );
}
