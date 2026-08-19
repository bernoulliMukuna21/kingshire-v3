import { Suspense } from "react";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";
import BrowseModeTabs from "@/components/ui/BrowseModeTabs";
import BrowseSkeleton from "@/components/ui/BrowseSkeleton";
import PlacementsBrowse from "./PlacementsBrowse";

export default function PublicPlacementsPage() {
  return (
    <PublicShell>
      <PublicHero
        title="Placements"
        description="Supervised opportunities offering mentoring, training and a verified experience record. These are not paid jobs."
      >
        <BrowseModeTabs active="placements" />
      </PublicHero>
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<BrowseSkeleton />}>
            <PlacementsBrowse />
          </Suspense>
        </div>
      </section>
    </PublicShell>
  );
}
