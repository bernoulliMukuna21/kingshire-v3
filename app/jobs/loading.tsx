import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PublicShell from "@/components/ui/PublicShell";

export default function JobsLoading() {
  return (
    <PublicShell>
      <div className="pt-20">
        <LoadingSkeleton />
      </div>
    </PublicShell>
  );
}
