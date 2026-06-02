"use client";

import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  CheckCircle,
  ChevronRight,
  LayoutDashboard,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const floatingAvatars = [
  {
    initials: "AO",
    color: "from-purple-500 to-pink-500",
    label: "Graphic Designer",
    rating: "4.9",
    top: "18%",
    left: "5%",
    delay: 0,
    dur: 7,
  },
  {
    initials: "ST",
    color: "from-green-500 to-emerald-500",
    label: "Web Developer",
    rating: "5.0",
    top: "20%",
    right: "5%",
    delay: 1,
    dur: 9,
  },
  {
    initials: "GM",
    color: "from-orange-500 to-rose-500",
    label: "Photographer",
    rating: "4.8",
    top: "62%",
    left: "4%",
    delay: 0.5,
    dur: 8,
  },
  {
    initials: "ER",
    color: "from-red-500 to-orange-500",
    label: "Video Editor",
    rating: "4.7",
    top: "60%",
    right: "4%",
    delay: 1.5,
    dur: 10,
  },
];

const trustBadges = [
  "Stripe-secured payments",
  "Community verified",
  "Free to join",
  "5% platform fee",
];

const stats = [
  { value: "2,400+", label: "People registered" },
  { value: "£180k+", label: "Paid out to Kinglancers" },
  { value: "98%", label: "Satisfaction rate" },
];

export default function HeroSection() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dashboardHref, setDashboardHref] = useState("/dashboard/client");

  useEffect(() => {
    const supabase = createClient();

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const [{ data: authData }, { data: profile }] = await Promise.all([
          supabase.auth.getUser(),
          supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single(),
        ]);

        if (authData.user) {
          setIsLoggedIn(true);
          if (profile?.role === "kinglancer")
            setDashboardHref("/dashboard/kinglancer");
        }
      }
    })();
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Animated gradient background */}
      <motion.div
        style={{ y: heroY }}
        className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#1e3a7a] to-[#0f172a] animate-gradient"
      />

      {/* Floating orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 30, 0] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, 20, 0] }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute top-1/2 right-1/3 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl"
        />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />

      {/* Floating skill cards */}
      {floatingAvatars.map((a, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 1 + i * 0.15 }}
          style={{
            position: "absolute",
            top: a.top,
            left: "left" in a ? (a as { left: string }).left : undefined,
            right: "right" in a ? (a as { right: string }).right : undefined,
          }}
          className="hidden xl:flex flex-col items-center pointer-events-none"
        >
          <motion.div
            animate={{ y: [0, -10, 0] }}
            transition={{
              duration: a.dur,
              repeat: Infinity,
              ease: "easeInOut",
              delay: a.delay,
            }}
            className="flex flex-col items-center gap-1.5"
          >
            <div
              className={`w-12 h-12 rounded-2xl bg-linear-to-br ${a.color} flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-black/30 border border-white/20`}
            >
              {a.initials}
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-xl px-3 py-1.5 text-center">
              <p className="text-white/90 text-[10px] font-semibold whitespace-nowrap">
                {a.label}
              </p>
              <p className="text-yellow-400 text-[10px]">★ {a.rating}</p>
            </div>
          </motion.div>
        </motion.div>
      ))}

      {/* Main content */}
      <motion.div
        style={{ opacity: heroOpacity }}
        className="relative z-10 text-center px-6 max-w-5xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8"
        >
          <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white/90 text-sm font-medium">
            Trusted · Secure · Fair
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-5xl md:text-7xl font-black text-white leading-tight tracking-tight"
        >
          Hire from your{" "}
          <span className="relative">
            <span className="text-gradient">talent.</span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.8, delay: 1, ease: "easeOut" }}
              className="absolute -bottom-1 left-0 right-0 h-0.5 bg-linear-to-r from-blue-400 to-cyan-400 origin-left"
            />
          </span>
          <br />
          <span className="text-white/80">Earn from your skills.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 text-lg md:text-xl text-white/60 max-w-2xl mx-auto leading-relaxed"
        >
          KingsHire connects people who need work done with skilled people who
          can do it — with trust, security, and fair pay built in from the
          start.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
        >
          {isLoggedIn ? (
            <>
              <Link
                href={dashboardHref}
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/30 text-base"
              >
                <LayoutDashboard size={18} />
                Go to Dashboard
              </Link>
              <Link
                href="/jobs"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 text-base"
              >
                Browse Jobs
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/sign-up?role=client"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-500/30 text-base"
              >
                Post a Job
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <Link
                href="/sign-up?role=kinglancer"
                className="group inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 text-base"
              >
                Offer Your Skills
                <ChevronRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
            </>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="mt-10 flex flex-wrap justify-center gap-8"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
            </div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-14 flex flex-wrap justify-center gap-6 text-white/50 text-sm"
        >
          {trustBadges.map((item) => (
            <span key={item} className="flex items-center gap-1.5">
              <CheckCircle size={14} className="text-green-400" />
              {item}
            </span>
          ))}
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-white/30 text-xs tracking-widest uppercase">
          Scroll
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-0.5 h-8 bg-linear-to-b from-white/30 to-transparent rounded-full"
        />
      </motion.div>
    </section>
  );
}
