import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/ui/PageHeader";
import PublicShell from "@/components/ui/PublicShell";
import RequestView from "./RequestView";

export default async function RequestKinglancerPage({
  params,
}: {
  params: Promise<{ kinglancerId: string }>;
}) {
  const { kinglancerId } = await params;
  const supabase = await createClient();

  const [
    {
      data: { user },
    },
    { data: kinglancer },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("profiles")
      .select("id, full_name, service_tags, services, avatar_url")
      .eq("id", kinglancerId)
      .eq("role", "kinglancer")
      .single(),
  ]);

  if (!user) redirect(`/sign-in?next=/jobs/request/${kinglancerId}`);
  if (!kinglancer) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

  const serviceTags =
    kinglancer.services?.length > 0
      ? kinglancer.services.map((s: { name: string }) => s.name)
      : (kinglancer.service_tags ?? []);

  const firstName = kinglancer.full_name?.split(" ")[0] ?? "them";

  return (
    <PublicShell withFooter={false} navbarVariant="solid">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <PageHeader
          eyebrow="Direct Request"
          title={`Send a Request to ${kinglancer.full_name}`}
          description={`Describe the work clearly. ${firstName} can accept, decline, or suggest changes before you fund escrow.`}
          action={
            <Link
              href={`/kinglancers/${kinglancerId}`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 transition-colors hover:bg-white/20"
            >
              <ArrowLeft size={14} />
              Back to profile
            </Link>
          }
        />

        <RequestView
          kinglancer={{
            id: kinglancer.id,
            fullName: kinglancer.full_name,
            serviceTags,
            avatarUrl: kinglancer.avatar_url,
          }}
          kinglancerId={kinglancerId}
        />
      </div>
    </PublicShell>
  );
}
