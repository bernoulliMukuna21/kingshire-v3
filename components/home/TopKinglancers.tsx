import Link from "next/link";
import { unstable_cache } from "next/cache";
import { Star, ArrowRight } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/animations";
import { createServiceClient } from "@/lib/supabase/service";

const GRADIENT_CYCLE = [
  "from-purple-500 to-pink-500",
  "from-blue-500 to-cyan-500",
  "from-orange-500 to-rose-500",
  "from-green-500 to-emerald-500",
  "from-indigo-500 to-violet-500",
  "from-red-500 to-orange-500",
];

const getTopKinglancers = unstable_cache(
  async () => {
    const supabase = createServiceClient();
    // Order by jobs_completed desc first, then by created_at asc as tiebreaker
    // so that until reviews exist, the earliest members are shown.
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, service_tags, rating, jobs_completed, tagline, services, bio",
      )
      .eq("role", "kinglancer")
      .order("jobs_completed", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(6);

    // Only surface complete profiles (bio + at least one priced service).
    return (data ?? []).filter((k) => {
      const hasBio = !!k.bio?.trim();
      const hasPricedService = Array.isArray(k.services) &&
        (k.services as { rate: number }[]).some((s) => Number(s.rate) > 0);
      return hasBio && hasPricedService;
    });
  },
  ["top-kinglancers"],
  { revalidate: 86400 }, // 24 hours — ranking changes very slowly
);

export default async function TopKinglancers() {
  const kinglancers = await getTopKinglancers();

  return (
    <section className="py-16 md:py-24 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-10 md:mb-16">
          <p className="text-blue-600 font-semibold text-sm tracking-widest uppercase mb-3">
            Community talent
          </p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight">
            Meet our top Kinglancers
          </h2>
          <p className="mt-4 text-gray-500 text-lg max-w-xl mx-auto">
            Real people from your community, ready to help.
          </p>
        </FadeIn>

        {kinglancers.length === 0 ? (
          <FadeIn className="text-center py-12">
            <p className="text-gray-500 mb-4">
              Be the first to sign up as a Kinglancer!
            </p>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors text-sm"
            >
              Join as a Kinglancer
            </Link>
          </FadeIn>
        ) : (
          <>
            {/* Mobile: horizontal scroll carousel */}
            <div className="sm:hidden -mx-6 px-6">
              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
                {kinglancers.map((k, i) => {
                  const color = GRADIENT_CYCLE[i % GRADIENT_CYCLE.length];
                  const serviceNames =
                    (k.services as { name: string }[] | null)
                      ?.map((service) => service.name)
                      .filter((name) => name.trim().length > 0) ?? [];
                  const headline =
                    k.tagline ||
                    serviceNames.slice(0, 2).join(" · ") ||
                    "Kinglancer";
                  const initials = k.full_name
                    .split(" ")
                    .map((n: string) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <Link
                      key={k.id}
                      href={`/kinglancers/${k.id}`}
                      className="group shrink-0 w-[72vw] max-w-[280px] snap-start block rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50"
                    >
                      <KinglancerCardContent
                        k={k}
                        color={color}
                        initials={initials}
                        headline={headline}
                      />
                    </Link>
                  );
                })}
              </div>
              {/* Scroll hint dots */}
              <div className="flex justify-center gap-1.5 mt-3">
                {kinglancers.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full bg-gray-300 ${i === 0 ? "w-4" : "w-1.5"}`}
                  />
                ))}
              </div>
            </div>

            {/* Tablet + desktop: grid */}
            <Stagger
              className="hidden sm:grid grid-cols-2 lg:grid-cols-3 gap-6"
              staggerDelay={0.08}
            >
              {kinglancers.map((k, i) => {
                const color = GRADIENT_CYCLE[i % GRADIENT_CYCLE.length];
                const serviceNames =
                  (k.services as { name: string }[] | null)
                    ?.map((service) => service.name)
                    .filter((name) => name.trim().length > 0) ?? [];
                const headline =
                  k.tagline ||
                  serviceNames.slice(0, 2).join(" · ") ||
                  "Kinglancer";
                const initials = k.full_name
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <StaggerItem key={k.id}>
                    <Link
                      href={`/kinglancers/${k.id}`}
                      className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-50"
                    >
                      <KinglancerCardContent
                        k={k}
                        color={color}
                        initials={initials}
                        headline={headline}
                      />
                    </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </>
        )}

        <FadeIn className="text-center mt-10">
          <Link
            href="/kinglancers"
            className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 rounded-xl text-gray-700 hover:border-blue-300 hover:text-blue-600 transition-colors font-medium text-sm"
          >
            View all Kinglancers <ArrowRight size={16} />
          </Link>
        </FadeIn>
      </div>
    </section>
  );
}

type KinglancerProfile = {
  full_name: string;
  avatar_url: string | null;
  jobs_completed: number;
  rating: number | null;
};

function KinglancerCardContent({
  k,
  color,
  initials,
  headline,
}: {
  k: KinglancerProfile;
  color: string;
  initials: string;
  headline: string;
}) {
  return (
    <>
      <div className="flex items-start gap-4 mb-4">
        <div
          className={`w-12 h-12 rounded-2xl bg-linear-to-br ${color} flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden`}
        >
          {k.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={k.avatar_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-bold text-gray-900 truncate">{k.full_name}</p>
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              Featured
            </span>
          </div>
          <p className="text-gray-500 text-sm truncate">{headline}</p>
        </div>
      </div>
      <div className="flex items-center justify-between pt-4 border-t border-gray-50">
        <div className="flex items-center gap-1">
          <Star size={14} className="text-yellow-400 fill-yellow-400" />
          <span className="text-sm font-semibold text-gray-700">
            {k.jobs_completed > 0 ? Number(k.rating).toFixed(1) : "New"}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {k.jobs_completed} jobs completed
        </span>
        <span className="text-xs text-blue-600 font-medium group-hover:underline">
          View profile →
        </span>
      </div>
    </>
  );
}
