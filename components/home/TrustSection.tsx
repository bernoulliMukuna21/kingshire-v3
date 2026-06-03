"use client";

import { motion } from "framer-motion";
import { Shield, Zap, Star } from "lucide-react";
import { FadeIn } from "@/components/animations";

const features = [
  {
    icon: Shield,
    title: "Escrow protection",
    desc: "Funds held securely until work is approved",
  },
  {
    icon: Zap,
    title: "Instant release",
    desc: "Payment released the moment you approve",
  },
  {
    icon: Star,
    title: "Dispute support",
    desc: "Our team steps in manually if anything goes wrong",
  },
];

export default function TrustSection() {
  return (
    <section className="py-16 md:py-24 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <FadeIn direction="right">
            <p className="text-blue-600 font-semibold text-sm tracking-widest uppercase mb-3">
              Built on trust
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight mb-6">
              Your money is safe.
              <br />
              <span className="text-gradient">Always.</span>
            </h2>
            <p className="text-gray-500 text-lg leading-relaxed mb-8">
              Every payment goes into secure escrow managed by Stripe — the same
              technology used by the world&apos;s biggest platforms. Nobody
              touches the money until the work is done and approved.
            </p>
            <div className="space-y-4">
              {features.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{title}</p>
                    <p className="text-gray-500 text-sm">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn direction="left" delay={0.2}>
            <div className="relative">
              <div className="bg-linear-to-br from-[#1a2e5a] to-[#1e3a8a] rounded-3xl p-8 text-white shadow-2xl shadow-blue-900/30 animate-float">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <p className="text-white/50 text-sm">Escrow balance</p>
                    <p className="text-3xl font-black mt-1">£850.00</p>
                  </div>
                  <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Shield size={24} className="text-white" />
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Job", value: "Website redesign" },
                    { label: "Kinglancer", value: "Jane T." },
                    {
                      label: "Status",
                      value: "Work in progress",
                      highlight: true,
                    },
                  ].map(({ label, value, highlight }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between py-3 border-b border-white/10 last:border-0"
                    >
                      <span className="text-white/50 text-sm">{label}</span>
                      <span
                        className={`text-sm font-medium ${highlight ? "text-green-400" : "text-white"}`}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  aria-hidden="true"
                  className="mt-6 w-full rounded-xl bg-green-500 py-3 text-center text-sm font-semibold text-white"
                >
                  Approve & Release Payment
                </div>
              </div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
                className="absolute -top-4 -right-4 bg-white rounded-2xl shadow-xl px-4 py-3 border border-gray-100"
              >
                <p className="text-xs text-gray-500">Platform fee</p>
                <p className="font-black text-gray-900">5% only</p>
              </motion.div>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
