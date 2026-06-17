import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// POST /api/profile/revalidate
// Called by ProfileForm after a successful profile save.
// Purges the ISR cache for the kinglancer's public profile and listing pages
// so visitors see updated data immediately.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Revalidate unstable_cache data entries first, then the rendered page cache.
  // Both layers must be purged for visitors to see updated profile data immediately.
  // expire: 0 = immediate expiration (no stale-while-revalidate delay).
  revalidateTag(`kinglancer-profile-${user.id}`, { expire: 0 });
  revalidateTag("kinglancer-profiles", { expire: 0 });
  revalidatePath(`/kinglancers/${user.id}`);
  revalidatePath("/kinglancers");

  return NextResponse.json({ revalidated: true });
}
