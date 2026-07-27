"use client";

import Image from "next/image";
import Link from "next/link";
import { Check, LockKeyhole } from "lucide-react";

export const ORGANISATION_SETUP_STEPS = [
  { id: "account", label: "Account", detail: "Secure personal login" },
  { id: "organisation", label: "Organisation", detail: "Name and type" },
  { id: "profile", label: "Profile", detail: "Public details" },
  { id: "plan", label: "Plan", detail: "Choose your allowance" },
  { id: "payment", label: "Review & payment", detail: "Confirm with Stripe" },
  { id: "team", label: "Invite team", detail: "Bring colleagues in" },
  { id: "complete", label: "Complete", detail: "Enter your workspace" },
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
  const currentIndex = ORGANISATION_SETUP_STEPS.findIndex(
    (step) => step.id === currentStep,
  );
  const progress = Math.round(
    ((currentIndex + 1) / ORGANISATION_SETUP_STEPS.length) * 100,
  );

  return (
    <div className="min-h-screen bg-[#f4f6fb]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/" aria-label="KingsHire home">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={140}
              height={40}
              className="h-9 w-auto"
              priority
            />
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <LockKeyhole size={15} className="text-emerald-600" />
            Secure Organisation setup
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white px-5 py-4 lg:hidden">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center justify-between text-xs">
            <span className="font-extrabold text-slate-900">
              Step {currentIndex + 1} of {ORGANISATION_SETUP_STEPS.length}:{" "}
              {ORGANISATION_SETUP_STEPS[currentIndex].label}
            </span>
            <span className="font-semibold text-blue-700">{progress}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1500px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)_260px] lg:py-12">
        <aside className="hidden lg:block">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
            Set up your Organisation
          </p>
          <ol
            className="mt-7 space-y-1"
            aria-label="Organisation setup progress"
          >
            {ORGANISATION_SETUP_STEPS.map((step, index) => {
              const completed = index < currentIndex;
              const active = index === currentIndex;
              return (
                <li
                  key={step.id}
                  aria-current={active ? "step" : undefined}
                  className={`flex gap-3 rounded-2xl px-3 py-3 ${
                    active ? "bg-white shadow-sm ring-1 ring-slate-200" : ""
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                      completed
                        ? "bg-emerald-600 text-white"
                        : active
                          ? "bg-blue-600 text-white"
                          : "border border-slate-300 text-slate-400"
                    }`}
                  >
                    {completed ? <Check size={14} /> : index + 1}
                  </span>
                  <span>
                    <span
                      className={`block text-sm font-extrabold ${
                        active || completed
                          ? "text-slate-900"
                          : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {step.detail}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="min-w-0">{children}</section>

        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Setup summary
            </p>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Organisation</dt>
                <dd className="mt-1 font-extrabold text-slate-900">
                  {organisationName || "Not added yet"}
                </dd>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <dt className="text-slate-500">Plan</dt>
                <dd className="mt-1 font-extrabold text-slate-900">
                  {planName
                    ? `${planName} · £${planPrice}/month`
                    : "Choose later"}
                </dd>
              </div>
              <div className="border-t border-slate-100 pt-4">
                <dt className="text-slate-500">Your role</dt>
                <dd className="mt-1 font-extrabold text-slate-900">Owner</dd>
              </div>
            </dl>
            <p className="mt-5 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
              The Owner controls billing, members and the Organisation
              workspace.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
