import { Suspense } from "react";
import PublicHero from "@/components/ui/PublicHero";
import PublicShell from "@/components/ui/PublicShell";
import BrowseModeTabs from "@/components/ui/BrowseModeTabs";
import BrowseSkeleton from "@/components/ui/BrowseSkeleton";
import JobsBrowse from "./JobsBrowse";

export default function JobsPage() {
  return (
    <PublicShell>
      <PublicHero
        title="Browse Jobs"
        description="Find paid work posted by trusted community members."
      >
        <BrowseModeTabs active="jobs" />
      </PublicHero>
      <section className="px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Suspense fallback={<BrowseSkeleton />}>
            <JobsBrowse />
          </Suspense>
        </div>
      </section>
    </PublicShell>
  );
}
