import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PostJobFormLoader from "./PostJobFormLoader";
import PageHeader from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function PostJobPage({
  searchParams,
}: {
  searchParams: Promise<{ kinglancer?: string }>;
}) {
  const supabase = await createClient();
  const { kinglancer: preferredKinglancerId } = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/onboarding");
  if (profile.role === "admin") redirect("/admin");
  if (profile.role === "kinglancer") redirect("/dashboard/kinglancer");
  if (profile.role !== "client") redirect("/onboarding");

  const { data: preferredKinglancer } = preferredKinglancerId
    ? await supabase
        .from("profiles")
        .select("id, full_name, service_tags, services, avatar_url")
        .eq("id", preferredKinglancerId)
        .eq("role", "kinglancer")
        .single()
    : { data: null };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        eyebrow="New job"
        title={
          preferredKinglancer
            ? `Post a job for ${preferredKinglancer.full_name}`
            : "Post a Job"
        }
        description={
          preferredKinglancer
            ? "Describe the work clearly. They still need to apply or be selected through the normal escrow-protected flow."
            : "Describe what you need and Kinglancers from your community will apply."
        }
      />

      <Card className="p-6">
        <PostJobFormLoader
          preferredKinglancer={
            preferredKinglancer
              ? {
                  id: preferredKinglancer.id,
                  fullName: preferredKinglancer.full_name,
                  serviceTags:
                    preferredKinglancer.services?.length > 0
                      ? preferredKinglancer.services.map(
                          (service) => service.name,
                        )
                      : (preferredKinglancer.service_tags ?? []),
                  avatarUrl: preferredKinglancer.avatar_url,
                }
              : null
          }
        />
      </Card>
    </div>
  );
}
