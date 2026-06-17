import { NextResponse } from "next/server";

// GET /api/auth/kingschat
// Redirects the browser to KingsChat's OAuth login page.
// The `origin` param carries the post-login destination so the callback
// can send the user to the right place after the Supabase session is created.
export async function GET(request: Request) {
  const clientId = process.env.KINGSCHAT_CLIENT_ID;
  if (!clientId) {
    console.error("[kingschat/auth] KINGSCHAT_CLIENT_ID is not set");
    return NextResponse.redirect(
      new URL("/sign-in?error=auth_failed", request.url),
    );
  }

  const { searchParams } = new URL(request.url);
  // `next` carries the destination path the user wanted before being sent
  // through the login flow (e.g. "/jobs/post"). Passed through as KingsChat's
  // `origin` param; it is echoed back unchanged in the callback payload.
  const next = searchParams.get("next") ?? "/";

  const loginUrl = new URL("https://accounts.kingschat.online/log-in");
  loginUrl.searchParams.set("clientId", clientId);
  loginUrl.searchParams.set("origin", next);

  return NextResponse.redirect(loginUrl.toString());
}
