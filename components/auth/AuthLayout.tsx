"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

interface AuthLayoutProps {
  headline: string;
  accent: string;
  body: string;
  bullets?: string[];
  children: React.ReactNode;
}

export default function AuthLayout({
  headline,
  accent,
  body,
  bullets,
  children,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-br from-[#0f172a] via-[#1e3a7a] to-[#0f172a] relative overflow-hidden flex-col justify-between p-12">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 8, repeat: Infinity }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 10, repeat: Infinity, delay: 2 }}
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={140}
              height={40}
              className="h-9 w-auto brightness-0 invert"
              priority
            />
          </Link>
        </div>

        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            {headline}
            <br />
            <span className="text-blue-400">{accent}</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">{body}</p>
          {bullets && (
            <div className="mt-8 space-y-3">
              {bullets.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 text-white/70 text-sm"
                >
                  <CheckCircle size={16} className="text-green-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="relative z-10 text-white/20 text-sm">© 2026 KingsHire</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        {children}
      </div>
    </div>
  );
}
