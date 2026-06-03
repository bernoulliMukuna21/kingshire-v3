import LoadingSkeleton from "@/components/ui/LoadingSkeleton";
import PublicShell from "@/components/ui/PublicShell";

export default function JobDetailLoading() {
  return (
    <PublicShell>
      <div className="pt-20">
        <LoadingSkeleton className="max-w-4xl" />
      </div>
    </PublicShell>
  );
}
