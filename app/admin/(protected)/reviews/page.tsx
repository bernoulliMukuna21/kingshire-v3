import { getAdminDb } from "@/lib/admin/access";
import AdminTabs from "@/components/admin/AdminTabs";
import Placements from "../placements/page";
import Experience from "../verifications/page";
export default async function AdminReviews({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await getAdminDb();
  const { tab } = await searchParams;
  const selected = tab === "experience" ? "experience" : "placements";
  return (
    <div>
      <h1 className="mb-2 text-2xl font-black">Reviews</h1>
      <p className="mb-6 text-sm text-slate-500">
        Approve placement listings and verify completed experience.
      </p>
      <AdminTabs
        selected={selected}
        tabs={[
          {
            label: "Placement publishing",
            value: "placements",
            href: "/admin/reviews?tab=placements",
          },
          {
            label: "Experience verification",
            value: "experience",
            href: "/admin/reviews?tab=experience",
          },
        ]}
      />
      {selected === "experience" ? <Experience /> : <Placements />}
    </div>
  );
}
