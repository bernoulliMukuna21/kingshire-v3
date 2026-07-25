import Link from "next/link";
import { ArrowRight, Building2, BriefcaseBusiness, Zap } from "lucide-react";
import PublicShell from "@/components/ui/PublicShell";

const paths = [
  {
    icon: BriefcaseBusiness,
    title: "I need work done",
    label: "Join as a Client",
    text: "Post paid jobs and hire trusted people for the work you need.",
    href: "/sign-up?role=client",
    featured: false,
  },
  {
    icon: Zap,
    title: "I want to find work",
    label: "Become a Kinglancer",
    text: "Offer your skills, discover jobs and get paid for your work.",
    href: "/sign-up?role=kinglancer",
    featured: false,
  },
  {
    icon: Building2,
    title: "I represent an Organisation",
    label: "Create an Organisation",
    text: "Create a team workspace for your company, charity, church, community group or public body.",
    href: "/organisations/start",
    featured: true,
  },
];

export default function GetStartedPage() {
  return (
    <PublicShell navbarVariant="solid">
      <section className="px-6 pb-20 pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-black uppercase tracking-widest text-blue-600">
              Get started
            </p>
            <h1 className="mt-3 text-4xl font-black text-slate-950 sm:text-5xl">
              How will you use KingsHire?
            </h1>
            <p className="mt-4 text-lg text-slate-600">
              Choose the journey that best describes what you want to do.
            </p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {paths.map(({ icon: Icon, title, label, text, href, featured }) => (
              <Link
                key={title}
                href={href}
                className={`group relative flex min-h-80 flex-col rounded-3xl border p-7 transition hover:-translate-y-1 hover:shadow-xl ${
                  featured
                    ? "border-blue-500 bg-[#10234b] text-white shadow-xl shadow-blue-950/15"
                    : "border-slate-200 bg-white text-slate-950"
                }`}
              >
                {featured && (
                  <span className="absolute right-5 top-5 rounded-full bg-blue-500 px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
                    For teams
                  </span>
                )}
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${featured ? "bg-blue-500" : "bg-blue-50 text-blue-700"}`}>
                  <Icon size={27} />
                </div>
                <h2 className="mt-7 text-2xl font-black">{title}</h2>
                <p className={`mt-3 leading-7 ${featured ? "text-white/65" : "text-slate-600"}`}>{text}</p>
                <span className={`mt-auto flex items-center gap-2 pt-8 font-bold ${featured ? "text-blue-300" : "text-blue-700"}`}>
                  {label} <ArrowRight size={18} className="transition group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account? <Link href="/sign-in" className="font-bold text-blue-700 hover:underline">Sign in</Link>
          </p>
        </div>
      </section>
    </PublicShell>
  );
}
