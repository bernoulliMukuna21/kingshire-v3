import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  CircleHelp,
  MessageSquare,
  Wallet,
} from "lucide-react";
import PublicShell from "@/components/ui/PublicShell";
import ContactForm from "@/components/support/ContactForm";
import { FEEDBACK_URL, SUPPORT_EMAIL } from "@/lib/contact";
import {
  contactHref,
  contactSource,
  deriveEnquiryView,
  enquiryTopics,
} from "@/lib/support/view";
export const metadata: Metadata = {
  title: "Contact KingsHire | Help, feedback and demos",
  description:
    "Get help with KingsHire, share feedback or request a walkthrough for your organisation.",
};
const options = [
  {
    topic: "account" as const,
    icon: CircleHelp,
    description: "Signing in, your profile or using KingsHire.",
  },
  {
    topic: "payment" as const,
    icon: Wallet,
    description: "A job, client payment or worker payout.",
  },
  {
    topic: "demo" as const,
    icon: Building2,
    description: "A guided look at KingsHire for your organisation.",
  },
  {
    topic: "feedback" as const,
    icon: MessageSquare,
    description:
      "Share your experience with KingsHire through our short Tally form.",
  },
];
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; from?: string; reference?: string }>;
}) {
  const params = await searchParams;
  if (params.topic === "feedback") redirect(FEEDBACK_URL);
  const topic =
    enquiryTopics.find((value) => value === params.topic) ?? "account";
  const sourcePath = contactSource(params.from);
  return (
    <PublicShell navbarVariant="solid">
      <div className="mx-auto max-w-6xl px-5 pb-20 pt-28 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
            Here to help
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Let’s make it easier.
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Get a hand with KingsHire, share your experience, or arrange a
            walkthrough for your team.
          </p>
        </div>
        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <nav aria-label="Contact options" className="space-y-3">
              {options.map(({ topic: value, icon: Icon, description }) => (
                <Link
                  key={value}
                  href={contactHref(value, sourcePath)}
                  aria-current={topic === value ? "page" : undefined}
                  className={`flex items-start gap-4 rounded-2xl border p-5 transition ${topic === value ? "border-blue-200 bg-blue-50 ring-1 ring-blue-100" : "border-slate-100 bg-white hover:border-blue-200"}`}
                >
                  <span className="rounded-xl bg-white p-2.5 text-blue-600">
                    <Icon size={21} />
                  </span>
                  <span>
                    <span className="font-bold text-slate-900">
                      {deriveEnquiryView(value).label}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-slate-500">
                      {description}
                    </span>
                  </span>
                  <ArrowUpRight
                    size={18}
                    className="ml-auto shrink-0 text-slate-400"
                  />
                </Link>
              ))}
            </nav>
            <div className="mt-6 px-2 text-sm leading-6 text-slate-500">
              <p>Prefer to write to us directly?</p>
              <a
                className="break-all font-semibold text-blue-600"
                href={`mailto:${SUPPORT_EMAIL}`}
              >
                {SUPPORT_EMAIL}
              </a>
            </div>
          </div>
          <ContactForm
            key={topic}
            topic={topic}
            sourcePath={sourcePath}
            reference={params.reference?.slice(0, 120)}
          />
        </div>
      </div>
    </PublicShell>
  );
}
