import { redirect } from "next/navigation";
import { hasValidAdminSession } from "@/lib/admin-auth";
import {
  getPageNumber as getSharedPageNumber,
  getPageRange as getSharedPageRange,
} from "@/lib/pagination";
import { createClient } from "@/lib/supabase/server";

export const ADMIN_PAGE_SIZE = 20;

export type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  service_tags: string[] | null;
  created_at: string;
  avatar_url: string | null;
};

export type AdminJob = {
  id: string;
  title: string;
  status: string;
  budget: number;
  categories?: string[] | null;
  created_at: string;
  client: { full_name: string | null } | null;
};

export type AdminDispute = {
  id: string;
  reason: string;
  created_at: string;
  status: string;
  raised_by: string;
  job: {
    id: string;
    title: string;
    budget: number;
    client_id: string;
    kinglancer_id: string | null;
  } | null;
};

export async function requireAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/");
  if (!(await hasValidAdminSession(user.id))) redirect("/admin/login");

  return { user };
}

export function getPageNumber(value: string | string[] | undefined) {
  return getSharedPageNumber(value);
}

export function getPageRange(page: number, pageSize = ADMIN_PAGE_SIZE) {
  return getSharedPageRange(page, pageSize);
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function roleTone(role: string | null) {
  if (role === "kinglancer") return "green";
  if (role === "admin") return "red";
  return "blue";
}

