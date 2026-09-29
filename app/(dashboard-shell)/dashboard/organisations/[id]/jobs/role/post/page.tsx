import { redirect } from "next/navigation";

// Role posting was merged into the main job-posting form (choose "Recurring
// role" there) — keep this route as a redirect for any existing links.
export default async function OrganisationRolePostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/organisations/${id}/jobs/post`);
}
