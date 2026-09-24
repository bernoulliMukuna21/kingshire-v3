import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletePushSubscription } from "@/lib/db/push-subscriptions";

// POST /api/push/unsubscribe — remove a browser's push subscription.
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
  if (!endpoint) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await deletePushSubscription(user.id, endpoint);
  return NextResponse.json({ success: true });
}
