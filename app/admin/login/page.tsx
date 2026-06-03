import Image from "next/image";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import AdminLoginForm from "./AdminLoginForm";
import {
  hasValidAdminSession,
  isAdminEmail,
  isAdminPasscodeConfigured,
} from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/sign-in");
  if (!isAdminEmail(user.email)) redirect("/");
  if (await hasValidAdminSession(user.id)) redirect("/admin");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eaf3ff_0,#f8fafc_38%,#e2e8f0_100%)] px-4 py-10 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <Card className="w-full p-7 sm:p-8">
          <div className="mb-7 text-center">
            <Image
              src="/logo.png"
              alt="KingsHire"
              width={150}
              height={40}
              className="mx-auto mb-6 h-10 w-auto"
              priority
            />
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <ShieldCheck size={26} />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
              Admin access
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Confirm admin passcode
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your email is on the admin allowlist. Enter the shared passcode to
              open the dashboard.
            </p>
          </div>

          {!isAdminPasscodeConfigured() ? (
            <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              ADMIN_PASSCODE is not configured for this environment.
            </p>
          ) : (
            <AdminLoginForm />
          )}
        </Card>
      </div>
    </main>
  );
}
