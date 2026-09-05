import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createUserSubscriptionCheckout,
  UserSubscriptionError,
} from "@/infrastructure/stripe/user-subscriptions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = profile?.role;
  if (role !== "client" && role !== "kinglancer") {
    return NextResponse.json(
      { error: "Subscriptions are for client and kinglancer accounts." },
      { status: 400 },
    );
  }

  try {
    const { url } = await createUserSubscriptionCheckout({
      userId: user.id,
      userEmail: user.email,
      role,
      requestUrl: request.url,
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof UserSubscriptionError) {
      const status = err.code === "already_active" ? 409 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[subscription] checkout failed:", err);
    return NextResponse.json(
      { error: "Unable to start the subscription right now." },
      { status: 502 },
    );
  }
}
