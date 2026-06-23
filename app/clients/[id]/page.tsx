import { unstable_cache } from "next/cache";
import { notFound } from "next/navigation";
import { ArrowLeft, Briefcase, Star } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import PublicShell from "@/components/ui/PublicShell";
import PublicHero from "@/components/ui/PublicHero";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import ReviewsList from "@/components/reviews/ReviewsList";
import { getPublishedReviewsForUser } from "@/lib/db/reviews";

export const revalidate = 3600;

export default async function ClientReputationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const getClient = unstable_cache(
    async () => {
      const supabase = createServiceClient();
      const [{ data: profile }, { count }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, avatar_url, role, rating, total_reviews")
          .eq("id", id)
          .eq("role", "client")
          .single(),
        supabase
          .from("jobs")
          .select("id", { count: "exact", head: true })
          .eq("client_id", id),
      ]);
      return profile ? { profile, jobsPosted: count ?? 0 } : null;
    },
    [`client-reputation-${id}`],
    {
      revalidate: 3600,
      tags: [`client-reputation-${id}`, "client-reputations"],
    },
  );

  const result = await getClient();
  if (!result) notFound();
  const { profile, jobsPosted } = result;

  const getReviews = unstable_cache(
    async () => getPublishedReviewsForUser(id, 30),
    [`client-reviews-${id}`],
    {
      revalidate: 3600,
      tags: [`client-reviews-${id}`, "client-reviews"],
    },
  );
  const reviews = await getReviews();

  const firstName = profile.full_name?.split(" ")[0] || "This client";
  const hasReviews = profile.total_reviews > 0;
  const ratingLabel = hasReviews ? Number(profile.rating).toFixed(1) : "New";

  return (
    <PublicShell>
      <PublicHero
        eyebrow="Client reputation"
        title={profile.full_name || "Client"}
        description="How this client is rated by Kinglancers they've worked with on KingsHire."
      >
        <ButtonLink href="/jobs" variant="secondary" size="sm">
          <ArrowLeft size={15} />
          Back to jobs
        </ButtonLink>
      </PublicHero>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <Card className="p-6 sm:p-8">
          <div className="flex items-center gap-5">
            <Avatar
              name={profile.full_name}
              src={profile.avatar_url}
              tone="blue"
              className="h-20 w-20 text-2xl"
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-black text-slate-950">
                {profile.full_name || "Client"}
              </h1>
              <p className="mt-1 text-sm font-bold text-blue-700">
                KingsHire client
              </p>
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
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                Reviews
              </p>
              <p className="mt-2 text-xl font-black text-slate-950">
                {profile.total_reviews}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                <Briefcase size={13} />
                Jobs posted
              </p>
              <p className="mt-2 text-xl font-black text-slate-950">
                {jobsPosted}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-black text-slate-950">
            Reviews from Kinglancers
          </h2>
          <div className="mt-4">
            <ReviewsList reviews={reviews} emptyName={firstName} />
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}
