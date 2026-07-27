"use client";

import Image from "next/image";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export const ORGANISATION_SETUP_STEPS = [
  { id: "account", label: "Account" },
  { id: "organisation", label: "Organisation" },
  { id: "profile", label: "Profile" },
  { id: "plan", label: "Plan" },
  { id: "payment", label: "Review & payment" },
  { id: "team", label: "Invite team" },
  { id: "complete", label: "Complete" },
] as const;

export type OrganisationSetupStep =
  (typeof ORGANISATION_SETUP_STEPS)[number]["id"];

type Props = {
  currentStep: OrganisationSetupStep;
  children: React.ReactNode;
  organisationName?: string;
  planName?: string;
  planPrice?: number;
};

export default function OrganisationSetupShell({
  currentStep,
  children,
  organisationName,
  planName,
  planPrice,
}: Props) {
  const prefersReducedMotion = useReducedMotion();
  const currentIndex = ORGANISATION_SETUP_STEPS.findIndex(
    (step) => step.id === currentStep,
  );
  const progress = Math.round(
    (currentIndex / (ORGANISATION_SETUP_STEPS.length - 1)) * 100,
  );

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-[minmax(360px,38%)_minmax(0,62%)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#10234b] lg:flex lg:flex-col lg:justify-between">
        <motion.div
          className="absolute -inset-5"
          initial={false}
          animate={
            prefersReducedMotion
              ? { scale: 1.03 }
              : {
                  scale: [1.03, 1.075, 1.03],
                  x: [0, -8, 0],
                  y: [0, 5, 0],
                }
          }
          transition={{
            duration: 20,
            ease: "easeInOut",
            repeat: prefersReducedMotion ? 0 : Infinity,
          }}
        >
          <Image
            src="/images/auth/organisation-team.jpg"
            alt=""
            fill
            sizes="38vw"
            className="object-cover"
            priority
          />
        </motion.div>
        <div className="absolute inset-0 bg-linear-to-b from-[#10234b]/45 via-[#10234b]/68 to-[#071631]/96" />

        <Link
          href="/"
          aria-label="KingsHire home"
          className="relative z-10 m-10 w-fit"
        >
          <Image
            src="/logo.png"
            alt="KingsHire"
            width={150}
            height={42}
            className="h-10 w-auto brightness-0 invert"
            priority
          />
        </Link>

        <div className="relative z-10 max-w-xl p-10 xl:p-14">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">
            KingsHire for Organisations
          </p>
          <h2 className="mt-5 text-4xl font-black leading-tight tracking-tight text-white xl:text-5xl">
            Build your workspace.
            <span className="mt-1 block text-blue-300">
              Bring your team together.
            </span>
          </h2>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/70 xl:text-lg">
            Create a trusted Organisation identity, choose the right plan and
            invite colleagues without sharing personal logins.
          </p>
          <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white/85 backdrop-blur-sm">
            <LockKeyhole size={14} className="text-emerald-300" />
            Every action stays attributable to an individual account
          </div>
        </div>
      </aside>

      <section className="flex min-h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-4 backdrop-blur sm:px-8 lg:justify-end">
          <Link href="/" aria-label="KingsHire home" className="lg:hidden">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={132}
              height={38}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <LockKeyhole size={15} className="text-emerald-600" />
            Secure Organisation setup
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-10 xl:px-14">
          <div className="w-full max-w-5xl">
            <div className="mx-auto mb-7 max-w-3xl">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                    Step {currentIndex + 1} of {ORGANISATION_SETUP_STEPS.length}
                  </p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">
                    {ORGANISATION_SETUP_STEPS[currentIndex].label}
                  </p>
                </div>
                {(organisationName || planName) && (
                  <p className="max-w-sm truncate text-right text-xs text-slate-500">
                    {organisationName && (
                      <strong className="text-slate-700">
                        {organisationName}
                      </strong>
                    )}
                    {organisationName && planName && " · "}
                    {planName && `${planName} · £${planPrice}/month`}
                  </p>
                )}
                <span className="text-xs font-bold text-slate-500">
                  {progress}% complete
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  className="h-full rounded-full bg-blue-600"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
                />
              </div>
            </div>
            {children}
          </div>
        </main>
      </section>
    </div>
  );
}
