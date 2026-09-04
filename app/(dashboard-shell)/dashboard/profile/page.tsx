import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";
import PayoutAccountForm from "./PayoutAccountForm";
import { getPayoutAccount } from "@/lib/db/payout-accounts";
import { BadgeCheck, Sparkles } from "lucide-react";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/sign-in");
  if (profile.role === "admin") redirect("/admin");
  if (!profile.role) redirect("/onboarding");

  const isKinglancer = profile.role === "kinglancer";
  const payoutAccount = isKinglancer ? await getPayoutAccount(user.id) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <div className="relative mb-8 overflow-hidden rounded-[2rem] bg-[#10234b] p-6 text-white shadow-2xl shadow-blue-950/15 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,197,94,0.24),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.28),transparent_34%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-sky-100 ring-1 ring-white/15">
              <Sparkles size={13} />
              Public identity
            </span>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              My Profile
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              {isKinglancer
                ? "Shape how clients see you: services, rates, profile photo, and proof that you are ready to work."
                : "Keep your account details accurate so KingsHire can support your work properly."}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-[#10234b] shadow-xl shadow-slate-950/20">
            <BadgeCheck size={18} className="text-emerald-600" />
            {isKinglancer ? "Kinglancer profile" : "Client profile"}
          </div>
        </div>
      </div>
      <ProfileForm profile={profile} />
      {isKinglancer && (
        <div className="mt-6">
          <PayoutAccountForm
            provider={payoutAccount?.payout_provider ?? null}
            link={payoutAccount?.payout_link ?? null}
          />
        </div>
      )}
    </div>
  );
}
