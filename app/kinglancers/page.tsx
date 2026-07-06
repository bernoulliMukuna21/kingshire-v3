import { unstable_cache } from "next/cache";
import { FadeIn } from "@/components/animations";
import { createServiceClient } from "@/lib/supabase/service";
import KinglancersGrid from "./KinglancersGrid";
import KinglancersSearch from "./KinglancersSearch";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";
import Pagination from "@/components/ui/Pagination";
import { getPageNumber, getPageRange } from "@/lib/pagination";

export const revalidate = 3600;

const PAGE_SIZE = 12;

export default async function KinglancersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: rawPage, q: rawQ } = await searchParams;
  const page = getPageNumber(rawPage);
  const q = (rawQ ?? "").trim();

  const { from, to } = getPageRange(page, PAGE_SIZE);

  const getKinglancers = unstable_cache(
    async () => {
      const supabase = createServiceClient();
      let query = supabase
        .from("profiles")
        .select(
          "id, full_name, avatar_url, service_tags, rating, jobs_completed, tagline, services",
          { count: "exact" },
        )
        .eq("role", "kinglancer")
        .order("jobs_completed", { ascending: false })
        .order("created_at", { ascending: true })
        .range(from, to);

      if (q) {
        query = query.or(`full_name.ilike.%${q}%,tagline.ilike.%${q}%`);
      }

      const { data, count } = await query;
      return { kinglancers: data ?? [], total: count ?? 0 };
    },
    [`kinglancers-p${page}-q${encodeURIComponent(q)}`],
    { revalidate: 3600, tags: ["kinglancer-profiles"] },
  );

  const { kinglancers, total } = await getKinglancers();

  return (
    <PublicShell>
      <FadeIn>
        <PublicHero
          eyebrow="Community Talent"
          title="Our Kinglancers"
          description="Skilled, verified members of your community — ready to deliver."
        />
      </FadeIn>
      <KinglancersSearch defaultValue={q} />
      <KinglancersGrid kinglancers={kinglancers} searchQuery={q} />
      <div className="mx-auto max-w-6xl pb-10 px-4 sm:px-6">
        <Pagination
          basePath="/kinglancers"
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
          itemLabel="kinglancers"
          params={q ? { q } : undefined}
        />
      </div>
    </PublicShell>
  );
}
