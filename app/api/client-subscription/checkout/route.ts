import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClientSubscriptionCheckout,
  ClientSubscriptionError,
} from "@/infrastructure/stripe/client-subscriptions";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  try {
    const { url } = await createClientSubscriptionCheckout({
      userId: user.id,
      userEmail: user.email,
      requestUrl: request.url,
    });
    return NextResponse.json({ url });
  } catch (err) {
    if (err instanceof ClientSubscriptionError) {
      const status = err.code === "already_active" ? 409 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[client-subscription] checkout failed:", err);
    return NextResponse.json(
      { error: "Unable to start the subscription right now." },
      { status: 502 },
    );
  }
}
