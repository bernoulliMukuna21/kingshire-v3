import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoleHome, isMarketplaceRole } from "@/lib/roles";

export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  // Behind Railway's reverse proxy, request.url may contain the internal
  // hostname. Use the configured public URL when available.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || requestOrigin;
  const code = searchParams.get("code");
  const next = searchParams.get("next"); // password-reset flow
  const signupRoleParam = searchParams.get("signup_role");
  const signupRole = isMarketplaceRole(signupRoleParam)
    ? signupRoleParam
    : null;
  const signupVia = searchParams.get("signup_via"); // "google" | "email"

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  }

  // Collect cookies set during the exchange so we can attach them to the
  // redirect response. Using request.cookies (not next/headers) ensures the
  // PKCE code-verifier cookie stored by the browser client is accessible here.
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            pendingCookies.push({ name, value, options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
  }

  // Determine where to send the user
  let destination: string;

  if (next) {
    // Password-reset flow → go straight to the reset page
    destination = `${origin}${next}`;
  } else if (signupRole) {
    if (signupVia === "google") {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // Use service client so the profile trigger does not revert `role`
        const serviceDb = createServiceClient();
        await serviceDb
          .from("profiles")
          .update({ role: signupRole as "client" | "kinglancer" })
          .eq("id", user.id);
      }
    }
    destination =
      signupRole === "client"
        ? `${origin}/dashboard/client`
        : `${origin}/onboarding?from=${signupVia ?? "google"}`;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    destination = `${origin}${getRoleHome(profile?.role)}`;
  }

  // Return the redirect with the session cookies attached
  const response = NextResponse.redirect(destination);
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(
      name,
      value,
      options as Parameters<typeof response.cookies.set>[2],
    ),
  );
  return response;
}
