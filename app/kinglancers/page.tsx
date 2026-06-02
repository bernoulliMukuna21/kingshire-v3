import Navbar from "@/components/Navbar";
import { FadeIn } from "@/components/animations";
import { createClient } from "@/lib/supabase/server";
import KinglancersGrid from "./KinglancersGrid";

export default async function KinglancersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, skills, rating, jobs_completed")
    .eq("role", "kinglancer")
    .order("jobs_completed", { ascending: false })
    .limit(60);

  const kinglancers = data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="bg-[#0f172a] pt-24 pb-16 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <p className="text-blue-400 text-xs font-semibold tracking-widest uppercase mb-3">
              Community Talent
            </p>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
              Our Kinglancers
            </h1>
            <p className="text-white/50 text-base">
              Skilled, verified members of your community — ready to deliver.
            </p>
          </FadeIn>
        </div>
      </div>

      <KinglancersGrid kinglancers={kinglancers} />
    </div>
  );
}
