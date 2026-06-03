import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoleHome, isMarketplaceRole } from "@/lib/roles";

function getGoogleProfileMetadata(metadata: Record<string, unknown>) {
  const fullName =
    typeof metadata.full_name === "string" && metadata.full_name.trim()
      ? metadata.full_name
      : typeof metadata.name === "string" && metadata.name.trim()
        ? metadata.name
        : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string" && metadata.avatar_url.trim()
      ? metadata.avatar_url
      : typeof metadata.picture === "string" && metadata.picture.trim()
        ? metadata.picture
        : null;

  return { fullName, avatarUrl };
}

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
    let existingRole: string | null = null;

    if (signupVia === "google") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
      }

      const { fullName, avatarUrl } = getGoogleProfileMetadata(
        user.user_metadata ?? {},
      );

      // Use service client so the profile trigger does not revert system fields.
      // Existing users keep their current role. New/unfinished Google users only
      // receive the client role immediately; kinglancer role is assigned after
      // they complete onboarding with at least one service.
      const serviceDb = createServiceClient();
      const { data: currentProfile, error: profileReadError } = await serviceDb
        .from("profiles")
        .select("role, avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (profileReadError) {
        return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
      }

      existingRole = currentProfile?.role ?? null;
      const roleToPersist = existingRole
        ? existingRole
        : signupRole === "client"
          ? "client"
          : null;

      const profilePayload: {
        id: string;
        email: string;
        full_name: string;
        role: string | null;
        avatar_url?: string;
      } = {
        id: user.id,
        email: user.email ?? "",
        full_name: fullName ?? user.email?.split("@")[0] ?? "KingsHire user",
        role: roleToPersist,
      };

      if (avatarUrl && !currentProfile?.avatar_url) {
        profilePayload.avatar_url = avatarUrl;
      }

      const { error: profileError } = await serviceDb
        .from("profiles")
        .upsert(profilePayload, { onConflict: "id" });

      if (profileError) {
        return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
      }
    }

    destination =
      existingRole === "admin" || existingRole === "kinglancer"
        ? `${origin}${getRoleHome(existingRole)}`
        : signupRole === "client"
        ? `${origin}/dashboard/client`
        : `${origin}/onboarding?from=${signupVia ?? "google"}&role=kinglancer&next=/dashboard/kinglancer`;
  } else {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(`${origin}/sign-in?error=auth_failed`);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, avatar_url")
      .eq("id", user.id)
      .single();

    const { avatarUrl } = getGoogleProfileMetadata(user.user_metadata ?? {});
    if (avatarUrl && profile && !profile.avatar_url) {
      const serviceDb = createServiceClient();
      await serviceDb
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
    }

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
