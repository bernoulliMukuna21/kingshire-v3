import AdminPagination from "@/components/admin/AdminPagination";
import AdminPanel from "@/components/admin/AdminPanel";
import { FadeIn } from "@/components/animations";
import { Avatar } from "@/components/ui/Avatar";
import PageHeader from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  ADMIN_PAGE_SIZE,
  type AdminUser,
  getPageNumber,
  getPageRange,
  roleTone,
  timeAgo,
} from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = getPageNumber(pageParam);
  const { from, to } = getPageRange(page);
  const serviceDb = createServiceClient();

  const { data, count } = await serviceDb
    .from("profiles")
    .select("id, email, full_name, role, service_tags, created_at, avatar_url", {
      count: "exact",
    })
    .or("role.is.null,role.neq.admin")
    .order("created_at", { ascending: false })
    .range(from, to);

  const users = (data ?? []) as AdminUser[];

  return (
    <>
      <FadeIn className="mb-8">
        <PageHeader
          eyebrow="Admin"
          title="Users"
          description="Marketplace users only. Admin profiles are intentionally excluded from this operational list."
        />
      </FadeIn>

      <FadeIn>
        <AdminPanel
          title="All Marketplace Users"
          description="Clients, kinglancers, and profiles still in onboarding."
          count={count ?? 0}
        >
          {users.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-400">No users found.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((profile) => (
                <div
                  key={profile.id}
                  className="grid gap-4 px-5 py-4 transition-colors hover:bg-gray-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar
                      name={profile.full_name || profile.email}
                      src={profile.avatar_url}
                      tone={roleTone(profile.role)}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-gray-900">
                        {profile.full_name || "Unnamed user"}
                      </p>
                      <p className="truncate text-xs text-gray-400">
                        {profile.email}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Joined {timeAgo(profile.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <StatusBadge
                      tone={roleTone(profile.role)}
                      className="capitalize"
                    >
                      {profile.role ?? "onboarding"}
                    </StatusBadge>
                    {profile.service_tags?.slice(0, 2).map((service) => (
                      <span
                        key={service}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <AdminPagination
            basePath="/admin/users"
            page={page}
            total={count ?? 0}
            pageSize={ADMIN_PAGE_SIZE}
          />
        </AdminPanel>
      </FadeIn>
    </>
  );
}
