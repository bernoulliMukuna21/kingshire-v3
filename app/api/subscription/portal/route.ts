import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createUserBillingPortalSession,
  UserSubscriptionError,
} from "@/infrastructure/stripe/user-subscriptions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role === "kinglancer" ? "kinglancer" : "client";

  try {
    const { url } = await createUserBillingPortalSession({
      userId: user.id,
      role,
      requestUrl: request.url,
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UserSubscriptionError && err.code === "not_found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[subscription] portal failed:", err);
    return NextResponse.json(
      { error: "Unable to open subscription management right now." },
      { status: 502 },
    );
  }
}
