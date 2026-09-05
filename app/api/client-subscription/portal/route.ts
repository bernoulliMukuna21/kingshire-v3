import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClientBillingPortalSession,
  ClientSubscriptionError,
} from "@/infrastructure/stripe/client-subscriptions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { url } = await createClientBillingPortalSession({
      userId: user.id,
      requestUrl: request.url,
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ClientSubscriptionError && err.code === "not_found") {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    console.error("[client-subscription] portal failed:", err);
    return NextResponse.json(
      { error: "Unable to open subscription management right now." },
      { status: 502 },
    );
  }
}
