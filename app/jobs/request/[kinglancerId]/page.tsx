import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
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

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 pt-20 pb-12 sm:px-6 lg:px-8">
      <Link
        href={`/kinglancers/${kinglancerId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to {kinglancer.full_name}&apos;s profile
      </Link>

      <RequestView
        kinglancer={{
          id: kinglancer.id,
          fullName: kinglancer.full_name,
          serviceTags,
          avatarUrl: kinglancer.avatar_url,
        }}
      />
    </div>
  );
}
