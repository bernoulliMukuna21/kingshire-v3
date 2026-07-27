"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
  LayoutDashboard,
  PartyPopper,
} from "lucide-react";
import { usePublicAuth } from "@/components/auth/PublicAuthProvider";
import PublicityBanner from "@/components/home/PublicityBanner";

const floatingAvatars = [
  {
    initials: "AO",
    color: "from-purple-500 to-pink-500",
    label: "Graphic Designer",
    rating: "4.9",
    top: "18%",
    left: "5%",
    delay: 0,
    duration: 7,
  },
  {
    initials: "ST",
    color: "from-green-500 to-emerald-500",
    label: "Web Developer",
    rating: "5.0",
    top: "20%",
    right: "5%",
    delay: 1,
    duration: 9,
  },
  {
    initials: "GM",
    color: "from-orange-500 to-rose-500",
    label: "Photographer",
    rating: "4.8",
    top: "62%",
    left: "4%",
    delay: 0.5,
    duration: 8,
  },
  {
    initials: "ER",
    color: "from-red-500 to-orange-500",
    label: "Video Editor",
    rating: "4.7",
    top: "60%",
    right: "4%",
    delay: 1.5,
    duration: 10,
  },
];

const trustBadges = [
  "Stripe-secured payments",
  "Community verified",
  "Free to join",
  "Low platform fees",
];

type HeroStat = {
  value: string;
  label: string;
};

export default function HeroSection({ stats }: { stats: HeroStat[] }) {
  const heroRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const { isLoggedIn, role, dashboardHref } = usePublicAuth();
  const secondaryCta =
    role === "client"
      ? { href: "/jobs/post", label: "Post a Job" }
      : { href: "/jobs", label: "Browse Jobs" };

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen overflow-hidden bg-[#10234b] pt-16"
    >
      <PublicityBanner
        tone="celebration"
        icon={<PartyPopper size={17} aria-hidden="true" />}
        title="Something new to celebrate: Organisation workspaces."
        message="Create your Organisation, invite your team and publish jobs together."
        ctaLabel="Discover"
        ctaHref="/organisation"
      />

      <motion.div
        style={{ y: heroY }}
        className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#1e3a7a] to-[#0f172a]"
      />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-blue-500/18 blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-1/3 right-1/4 h-80 w-80 rounded-full bg-indigo-500/18 blur-3xl"
        />
      </div>

      {floatingAvatars.map((avatar, index) => (
        <motion.div
          key={avatar.initials}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 + index * 0.15 }}
          style={{
            position: "absolute",
            top: avatar.top,
            left:
              "left" in avatar
                ? (avatar as { left: string }).left
                : undefined,
            right:
              "right" in avatar
                ? (avatar as { right: string }).right
                : undefined,
          }}
          className="pointer-events-none hidden flex-col items-center xl:flex"
        >
          <motion.div
            animate={{ y: prefersReducedMotion ? 0 : [0, -10, 0] }}
            transition={{
              duration: avatar.duration,
              repeat: prefersReducedMotion ? 0 : Infinity,
              ease: "easeInOut",
              delay: avatar.delay,
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border border-white/20 bg-linear-to-br ${avatar.color} text-sm font-bold text-white shadow-lg shadow-black/30`}
            >
              {avatar.initials}
            </div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-1.5 text-center backdrop-blur-md">
              <p className="whitespace-nowrap text-[10px] font-semibold text-white/90">
                {avatar.label}
              </p>
              <p className="text-[10px] text-yellow-400">★ {avatar.rating}</p>
            </div>
          </motion.div>
        </motion.div>
      ))}

      <motion.div
        style={{ opacity: heroOpacity }}
        className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col items-center justify-center px-6 py-16 text-center"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm"
        >
          <span className="h-2 w-2 rounded-full bg-green-400" />
          <span className="text-sm font-medium text-white/90">
            Trusted · Secure · Fair
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-4xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-5xl md:text-7xl"
        >
          Hired for your{" "}
          <span className="relative">
            <span className="text-gradient">talent.</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
              className="absolute -bottom-1 left-0 right-0 h-0.5 origin-left bg-linear-to-r from-blue-400 to-cyan-400"
            />
          </span>
          <br />
          <span className="text-white/80">Paid for your work.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg md:text-xl"
        >
          KingsHire connects people who need work done with skilled people who
          can do it—with trust, security and fair pay built in from the start.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
        >
          {isLoggedIn ? (
            <>
              <Link
                href={dashboardHref}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:bg-blue-500 active:scale-95 sm:px-8 sm:py-4 sm:text-base"
              >
                <LayoutDashboard size={18} />
                Go to Dashboard
              </Link>
              <Link
                href={secondaryCta.href}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20 active:scale-95 sm:px-8 sm:py-4 sm:text-base"
              >
                {secondaryCta.label}
                <ChevronRight size={18} />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-up?role=client"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:bg-blue-500 active:scale-95 sm:px-8 sm:py-4 sm:text-base"
              >
                Post a Job <ArrowRight size={18} />
              </Link>
              <Link
                href="/sign-up?role=kinglancer"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20 active:scale-95 sm:px-8 sm:py-4 sm:text-base"
              >
                Offer Your Services <ChevronRight size={18} />
              </Link>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-8 flex flex-wrap justify-center gap-6 sm:gap-8"
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-extrabold text-white">{stat.value}</p>
              <p className="mt-0.5 text-xs text-white/40">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-white/50 sm:mt-12 sm:gap-6 sm:text-sm"
        >
          {trustBadges.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-400" />
              {item}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
