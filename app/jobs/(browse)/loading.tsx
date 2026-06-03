import { JobsIndexLoadingSkeleton } from "@/components/jobs/JobsLoadingSkeleton";
import PublicShell from "@/components/ui/PublicShell";

export default function JobsLoading() {
  return (
    <PublicShell>
      <JobsIndexLoadingSkeleton />
    </PublicShell>
  );
}
