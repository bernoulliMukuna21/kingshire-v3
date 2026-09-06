import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error:
        "Organisation creation now requires the guided subscription setup.",
      setup_url: "/organisation/setup",
    },
    { status: 409 },
  );
}
