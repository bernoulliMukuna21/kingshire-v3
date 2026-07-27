import { createServiceClient } from "@/lib/supabase/service";
import { OrganisationError } from "@/modules/organisations/domain/errors";
import type {
  OrganisationMemberRole,
  OrganisationType,
} from "@/modules/organisations/domain/types";

const DASHBOARD_JOB_LIMIT = 20;
const DASHBOARD_MEMBER_LIMIT = 100;
const TRANSACTION_PAGE_SIZE = 50;

export async function getUserOrganisationSummaries(
  userId: string,
  limit?: number,
) {
  let query = createServiceClient()
    .from("organisation_members")
    .select(
      "role, organisation:organisations!inner(id, name, organisation_type, location, deleted_at)",
    )
    .eq("user_id", userId)
    .is("organisation.deleted_at", null)
    .order("joined_at", { ascending: true });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) {
    throw new OrganisationError(
      "persistence_failure",
      "Unable to load Organisation workspaces.",
    );
  }
  return (data ?? []).map((membership) => {
    const organisation = membership.organisation as unknown as {
      id: string;
      name: string;
      organisation_type: OrganisationType;
      location: string | null;
    };
    return {
      ...organisation,
      role: membership.role as OrganisationMemberRole,
    };
  });
}

export async function getOrganisationName(organisationId: string) {
  const { data } = await createServiceClient()
    .from("organisations")
    .select("name")
    .eq("id", organisationId)
    .is("deleted_at", null)
    .maybeSingle();
  return data?.name ?? null;
}

export async function getOrganisationInvitationView(token: string) {
  const { data } = await createServiceClient()
    .from("organisation_invitations")
    .select(
      "email, role, expires_at, accepted_at, organisation:organisations(name)",
    )
    .eq("token", token)
    .maybeSingle();
  if (
    !data ||
    data.accepted_at ||
    new Date(data.expires_at) <= new Date()
  ) {
    return null;
  }
  return {
    email: data.email,
    role: data.role as Exclude<OrganisationMemberRole, "owner">,
    organisationName:
      (data.organisation as unknown as { name: string } | null)?.name ?? "",
  };
}

export async function getOrganisationOverview(organisationId: string) {
  const db = createServiceClient();
  const [
    organisationResult,
    jobsResult,
    membersResult,
    statsResult,
    subscriptionResult,
  ] =
    await Promise.all([
      db.from("organisations").select("*").eq("id", organisationId).single(),
      db
        .from("jobs")
        .select("id, title, budget, status, created_at")
        .eq("organisation_id", organisationId)
        .order("created_at", { ascending: false })
        .limit(DASHBOARD_JOB_LIMIT),
      db
        .from("organisation_members")
        .select(
          "user_id, role, joined_at, profile:profiles!user_id(full_name, email)",
        )
        .eq("organisation_id", organisationId)
        .order("joined_at", { ascending: true })
        .limit(DASHBOARD_MEMBER_LIMIT),
      db.rpc("get_organisation_stats", {
        p_organisation_id: organisationId,
      }),
      db
        .from("organisation_subscriptions")
        .select("plan, status, cancel_at_period_end, current_period_end")
        .eq("organisation_id", organisationId)
        .maybeSingle(),
    ]);

  if (organisationResult.error || !organisationResult.data) return null;
  if (
    jobsResult.error ||
    membersResult.error ||
    statsResult.error ||
    subscriptionResult.error
  ) {
    throw new OrganisationError(
      "persistence_failure",
      "Unable to load the Organisation workspace.",
    );
  }

  const stats = Array.isArray(statsResult.data)
    ? statsResult.data[0]
    : statsResult.data;
  return {
    organisation: organisationResult.data as {
      id: string;
      name: string;
      organisation_type: OrganisationType;
      description: string | null;
      country: string;
      location: string | null;
      website: string | null;
      email: string | null;
      registration_number: string | null;
    },
    jobs: jobsResult.data ?? [],
    members: (membersResult.data ?? []).map((member) => ({
      userId: member.user_id,
      role: member.role as OrganisationMemberRole,
      joinedAt: member.joined_at,
      profile: member.profile as unknown as {
        full_name: string;
        email: string;
      },
    })),
    stats: {
      jobCount: Number(stats?.job_count ?? 0),
      memberCount: Number(stats?.member_count ?? 0),
      releasedSpend: Number(stats?.released_spend ?? 0),
    },
    subscription: subscriptionResult.data,
  };
}

export async function getOrganisationTransactions(
  organisationId: string,
  page = 1,
) {
  const normalizedPage = Math.max(1, page);
  const from = (normalizedPage - 1) * TRANSACTION_PAGE_SIZE;
  const to = from + TRANSACTION_PAGE_SIZE - 1;
  const db = createServiceClient();
  const [{ data: organisation }, transactionsResult] = await Promise.all([
    db.from("organisations").select("name").eq("id", organisationId).single(),
    db
      .from("transactions")
      .select(
        "id, job_id, amount, platform_fee_client, status, created_at, job:jobs!inner(title, organisation_id), kinglancer:profiles!kinglancer_id(full_name)",
        { count: "exact" },
      )
      .eq("job.organisation_id", organisationId)
      .order("created_at", { ascending: false })
      .range(from, to),
  ]);
  if (!organisation || transactionsResult.error) return null;

  return {
    organisationName: organisation.name,
    transactions: (transactionsResult.data ?? []).map((transaction) => ({
      id: transaction.id,
      jobId: transaction.job_id,
      amount: Number(transaction.amount),
      platformFeeClient: Number(transaction.platform_fee_client),
      status: transaction.status,
      createdAt: transaction.created_at,
      jobTitle: (transaction.job as unknown as { title: string }).title,
      kinglancerName:
        (
          transaction.kinglancer as unknown as {
            full_name: string;
          } | null
        )?.full_name ?? "Kinglancer",
    })),
    page: normalizedPage,
    pageSize: TRANSACTION_PAGE_SIZE,
    total: transactionsResult.count ?? 0,
  };
}
