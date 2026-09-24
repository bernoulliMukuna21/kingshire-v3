import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { upsertPushSubscription } from "@/lib/db/push-subscriptions";

// POST /api/push/subscribe — save a browser's push subscription for the
// signed-in user.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh =
    typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Invalid subscription" },
      { status: 400 },
    );
  }

  try {
    await upsertPushSubscription(
      user.id,
      { endpoint, keys: { p256dh, auth } },
      request.headers.get("user-agent") ?? undefined,
    );
  } catch (err) {
    console.error("[push/subscribe] save failed:", err);
    return NextResponse.json(
      { error: "Could not save subscription" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
