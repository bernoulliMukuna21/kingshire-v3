import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser } from "@/lib/push";

// POST /api/push/test — send the signed-in user a test push on their own
// subscribed devices. Used to verify the push pipeline end-to-end.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  await sendPushToUser(user.id, {
    title: "KingsHire",
    body: "Push notifications are working 🎉",
    link: "/dashboard",
  });

  return NextResponse.json({ success: true });
}
