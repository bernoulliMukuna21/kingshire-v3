import { unstable_cache } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, ExternalLink, MapPin, Star } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import ReviewsList from "@/components/reviews/ReviewsList";
import { getPublishedReviewsForUser } from "@/lib/db/reviews";
import { listPublicExperienceRecords } from "@/lib/db/placements";
import ServicesSection from "./ServicesSection";
import {
  BookingCard,
  BookingCardWrapper,
  AppliedToYourJobsBanner,
} from "./BookingCard";

export const revalidate = 3600;

// Defined outside the page function so the wrapper is created once, not on
// every render. Next.js builds the full cache key from the static prefix +
// serialised arguments automatically.
const getKinglancerProfile = unstable_cache(
  async (id: string) => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, role, bio, location, service_tags, rating, total_reviews, jobs_completed, tagline, hourly_rate, rate_type, services, portfolio_url, is_verified",
      )
      .eq("id", id)
      .eq("role", "kinglancer")
      .single();
    return data ?? null;
  },
  ["kinglancer-profile"],
  { revalidate: 3600, tags: ["kinglancer-profiles"] },
);

const getKinglancerReviews = unstable_cache(
  async (id: string) => getPublishedReviewsForUser(id, 30),
  ["kinglancer-reviews"],
  { revalidate: 3600, tags: ["kinglancer-reviews"] },
);

const getKinglancerExperience = unstable_cache(
  async (id: string) => listPublicExperienceRecords(id),
  ["kinglancer-experience"],
  { revalidate: 3600, tags: ["kinglancer-experience"] },
);

export default async function KinglancerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const kinglancer = await getKinglancerProfile(id);

  if (!kinglancer) notFound();

  const rawServices =
    (kinglancer.services as Array<{ rate: number }> | null) ?? [];

  const reviews = await getKinglancerReviews(id);
  const experience = await getKinglancerExperience(id);

  type Service = { name: string; rate: number; rate_type: string };
  const services = (kinglancer.services as Service[] | null) ?? [];
  const serviceNames = services
    .map((s) => s.name)
    .filter((n) => n.trim().length > 0);
  const pricedServices = services.filter((s) => Number(s.rate) > 0);
  const lowestServiceRate =
    pricedServices.length > 0
      ? Math.min(...pricedServices.map((s) => Number(s.rate)))
      : null;
  const profileHeadline =
    kinglancer.tagline || serviceNames.slice(0, 2).join(" · ") || "Kinglancer";
  const profileDescription =
    serviceNames.length > 0
      ? `${serviceNames.slice(0, 3).join(" · ")} available through KingsHire.`
      : "View services, rates, and profile details before sending a private request.";
  const ratingLabel =
    kinglancer.jobs_completed > 0
      ? Number(kinglancer.rating).toFixed(1)
      : "New";
  const bookingHref = `/jobs/request/${kinglancer.id}`;
  const firstName = kinglancer.full_name?.split(" ")[0] || "this Kinglancer";

  return (
    <PublicShell>
      <PublicHero
        eyebrow="Kinglancer profile"
        title={kinglancer.full_name || "Kinglancer"}
        description={profileDescription}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <ButtonLink href="/kinglancers" variant="secondary" size="sm">
            <ArrowLeft size={15} />
            Back to Kinglancers
          </ButtonLink>
        </div>
      </PublicHero>

      <BookingCardWrapper
        kinglancerId={kinglancer.id}
        kinglancerFirstName={firstName}
        bookingHref={bookingHref}
      />

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="p-6 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <Avatar
                name={kinglancer.full_name}
                src={kinglancer.avatar_url}
                tone="green"
                className="h-20 w-20 text-2xl"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black text-slate-950">
                    {kinglancer.full_name}
                  </h1>
                  {kinglancer.is_verified && (
                    <StatusBadge tone="green">Verified</StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-sm font-bold text-blue-700">
                  {profileHeadline}
                </p>
                {kinglancer.location && (
                  <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
                    <MapPin size={15} />
                    {kinglancer.location}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 border-t border-slate-100 pt-6 sm:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Star size={13} className="fill-yellow-400 text-yellow-400" />
                  Rating
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {ratingLabel}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Briefcase size={13} />
                  Jobs
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {kinglancer.jobs_completed}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Reviews
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {kinglancer.total_reviews}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-black text-slate-950">About</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {kinglancer.bio ||
                "This Kinglancer has not added a full bio yet."}
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Reviews</h2>
              {reviews.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-600">
                  <Star size={15} className="fill-yellow-400 text-yellow-400" />
                  {Number(kinglancer.rating).toFixed(1)} · {reviews.length}{" "}
                  {reviews.length === 1 ? "review" : "reviews"}
                </span>
              )}
            </div>
            <div className="mt-4">
              <ReviewsList reviews={reviews} emptyName={firstName} />
            </div>
          </Card>

          <AppliedToYourJobsBanner
            kinglancerId={kinglancer.id}
            kinglancerFirstName={firstName}
          />

          {services.length > 0 && (
            <ServicesSection services={kinglancer.services} />
          )}

          {experience.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-black text-slate-950">
                Placement Passport
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Verified experience placements completed through KingsHire.
              </p>
              <div className="mt-4 space-y-4">
                {experience.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    {rec.categories.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {rec.categories.map((c) => (
                          <span
                            key={c}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-black text-emerald-700"
                          >
                            ✓ {c}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-950">{rec.title}</p>
                      <span className="shrink-0 text-xs text-slate-400">
                        Verified by {rec.organisation?.name ?? "an organisation"}
                      </span>
                    </div>
                    {rec.summary && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                        {rec.summary}
                      </p>
                    )}
                    {rec.outcome && (
                      <p className="mt-2 text-sm text-slate-700">
                        <span className="font-semibold">Outcome:</span>{" "}
                        {rec.outcome}
                      </p>
                    )}
                    {rec.skills.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {rec.skills.map((s) => (
                          <span
                            key={s}
                            className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="hidden p-6 lg:block">
            <h2 className="text-lg font-black text-slate-950">
              Work with {firstName}
            </h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">
              Send a private job request. They can accept, decline, or suggest
              changes before you fund escrow.
            </p>
            <BookingCard
              kinglancerId={kinglancer.id}
              kinglancerFirstName={firstName}
              bookingHref={bookingHref}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">
              Services
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(kinglancer.service_tags ?? []).length > 0 ? (
                (kinglancer.service_tags as string[]).map((service) => (
                  <span
                    key={service}
                    className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700"
                  >
                    {service}
                  </span>
                ))
              ) : (
                <p className="text-sm text-slate-400">No services added yet.</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">
              Rate
            </h2>
            <p className="mt-3 text-2xl font-black text-slate-950">
              {lowestServiceRate !== null
                ? `From £${lowestServiceRate.toLocaleString()}`
                : kinglancer.hourly_rate
                  ? `£${Number(kinglancer.hourly_rate).toLocaleString()}`
                  : "Discuss"}
            </p>
            {lowestServiceRate !== null ? (
              <p className="mt-1 text-sm font-semibold text-slate-400">
                Listed service rate
              </p>
            ) : kinglancer.hourly_rate ? (
              <p className="mt-1 text-sm font-semibold text-slate-400">
                {(kinglancer.rate_type as string).replace("_", " ")}
              </p>
            ) : null}
          </Card>

          {kinglancer.portfolio_url && (
            <Card className="p-6">
              <Link
                href={kinglancer.portfolio_url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
              >
                View portfolio <ExternalLink size={14} />
              </Link>
            </Card>
          )}
        </aside>
      </div>
    </PublicShell>
  );
}
