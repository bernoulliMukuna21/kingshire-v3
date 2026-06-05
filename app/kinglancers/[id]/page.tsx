import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, ExternalLink, MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getRoleHome } from "@/lib/roles";

export default async function KinglancerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: kinglancer },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, role, bio, location, service_tags, rating, total_reviews, jobs_completed, tagline, hourly_rate, rate_type, services, portfolio_url, is_verified",
      )
      .eq("id", id)
      .eq("role", "kinglancer")
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!kinglancer) notFound();

  const { data: currentProfile } = user
    ? await supabase.from("profiles").select("role").eq("id", user.id).single()
    : { data: null };

  const serviceNames =
    kinglancer.services
      ?.map((service) => service.name)
      .filter((name) => name.trim().length > 0) ?? [];
  const pricedServices =
    kinglancer.services?.filter((service) => Number(service.rate) > 0) ?? [];
  const lowestServiceRate =
    pricedServices.length > 0
      ? Math.min(...pricedServices.map((service) => Number(service.rate)))
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

  const bookingCta =
    currentProfile?.role === "admin" ? (
      <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
        Admin accounts can inspect profiles but cannot book marketplace work.
      </p>
    ) : user?.id === kinglancer.id ? (
      <ButtonLink href="/dashboard/profile" className="w-full sm:w-auto">
        Edit your profile
      </ButtonLink>
    ) : currentProfile?.role === "client" ? (
      <ButtonLink href={bookingHref} className="w-full sm:w-auto">
        Request this Kinglancer
      </ButtonLink>
    ) : currentProfile?.role === "kinglancer" ? (
      <div className="space-y-3">
        <p className="text-sm text-slate-500">
          Switch to a client account before requesting another Kinglancer.
        </p>
        <ButtonLink
          href="/dashboard/settings"
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Go to settings
        </ButtonLink>
      </div>
    ) : user ? (
      <ButtonLink
        href={getRoleHome(currentProfile?.role)}
        className="w-full sm:w-auto"
      >
        Complete client setup
      </ButtonLink>
    ) : (
      <div className="flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/sign-up" className="w-full sm:w-auto">
          Sign up to request
        </ButtonLink>
        <ButtonLink
          href="/sign-in"
          variant="secondary"
          className="w-full sm:w-auto"
        >
          Sign in
        </ButtonLink>
      </div>
    );

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

      <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:hidden">
        <Card className="p-6">
          <h2 className="text-lg font-black text-slate-950">
            Work with {kinglancer.full_name?.split(" ")[0] || "this Kinglancer"}
          </h2>
          <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">
            Send a private job request. They can accept, decline, or suggest
            changes before you fund escrow.
          </p>
          {bookingCta}
        </Card>
      </div>

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

          {(kinglancer.services?.length ?? 0) > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-black text-slate-950">Services</h2>
              <div className="mt-4 divide-y divide-slate-100">
                {kinglancer.services.map((service, index) => {
                  const serviceRate = Number(service.rate);
                  return (
                    <div
                      key={`${service.name}-${service.rate}-${index}`}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <p className="text-sm font-bold text-slate-800">
                        {service.name}
                      </p>
                      <p className="text-sm font-black text-green-700">
                        {serviceRate > 0 ? (
                          <>
                            £{serviceRate.toLocaleString()}{" "}
                            <span className="font-semibold text-slate-400">
                              {service.rate_type.replace("_", " ")}
                            </span>
                          </>
                        ) : (
                          "Discuss"
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="hidden p-6 lg:block">
            <h2 className="text-lg font-black text-slate-950">
              Work with{" "}
              {kinglancer.full_name?.split(" ")[0] || "this Kinglancer"}
            </h2>
            <p className="mb-5 mt-2 text-sm leading-6 text-slate-500">
              Send a private job request. They can accept, decline, or suggest
              changes before you fund escrow.
            </p>
            {bookingCta}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-400">
              Services
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(kinglancer.service_tags ?? []).length > 0 ? (
                kinglancer.service_tags.map((service) => (
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
                {kinglancer.rate_type.replace("_", " ")}
              </p>
            ) : null}
          </Card>

          {kinglancer.portfolio_url && (
            <Card className="p-6">
              <Link
                href={kinglancer.portfolio_url}
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
