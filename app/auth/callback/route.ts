import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
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

function logAuthCallback(
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>,
) {
  if (level === "info" && process.env.AUTH_DEBUG_LOGS !== "true") return;

  console[level]("[auth/callback]", event, details);
}

function getSafeCookieDiagnostics(request: NextRequest) {
  const cookies = request.cookies.getAll();

  return {
    hasCodeVerifierCookie: cookies.some((cookie) =>
      cookie.name.includes("code-verifier"),
    ),
    hasSupabaseAuthCookie: cookies.some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    ),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams, origin: requestOrigin } = new URL(request.url);
  // Behind Railway's reverse proxy, request.url may contain the internal
  // hostname. Use the configured public URL when available.
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || requestOrigin;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  const next = searchParams.get("next"); // password-reset flow
  const signupRoleParam = searchParams.get("signup_role");
  const signupRole = isMarketplaceRole(signupRoleParam)
    ? signupRoleParam
    : null;
  const signupVia = searchParams.get("signup_via"); // "google" | "email"
  const flow = code ? "code" : tokenHash ? "token_hash" : "missing";
  const queryKeys = Array.from(searchParams.keys()).sort();
  const cookieDiagnostics = getSafeCookieDiagnostics(request);

  logAuthCallback("info", "received", {
    flow,
    tokenType,
    queryKeys,
    hasNext: Boolean(next),
    hasSignupRole: Boolean(signupRole),
    signupVia,
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    ...cookieDiagnostics,
  });

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

  const authResult = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && tokenType
      ? await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tokenType as EmailOtpType,
        })
      : { error: new Error("Missing auth callback code or token hash") };

  const { error } = authResult;

  if (error) {
    const reason = code
      ? "code_exchange_failed"
      : tokenHash && tokenType
        ? "otp_verify_failed"
        : "missing_callback_params";

    logAuthCallback("error", "auth_exchange_failed", {
      flow,
      tokenType,
      queryKeys,
      hasNext: Boolean(next),
      hasSignupRole: Boolean(signupRole),
      signupVia,
      reason,
      errorName: error.name,
      errorMessage: error.message,
      ...cookieDiagnostics,
    });
    return NextResponse.redirect(
      `${origin}/sign-in?error=auth_failed&reason=${reason}`,
    );
  }

  logAuthCallback("info", "auth_exchange_succeeded", {
    flow,
    tokenType,
    queryKeys,
    hasNext: Boolean(next),
    hasSignupRole: Boolean(signupRole),
    signupVia,
    ...cookieDiagnostics,
  });

  // Determine where to send the user
  let destination: string;

  if (next) {
    // Password-reset flow → go straight to the reset page
    destination = `${origin}${next}`;
  } else if (tokenType === "recovery") {
    destination = `${origin}/reset-password`;
  } else if (signupRole) {
    let existingRole: string | null = null;

    if (signupVia === "google") {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        logAuthCallback("error", "google_signup_missing_user", {
          signupRole,
          signupVia,
        });
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
        logAuthCallback("error", "google_signup_profile_read_failed", {
          signupRole,
          signupVia,
          errorMessage: profileReadError.message,
        });
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
        logAuthCallback("error", "google_signup_profile_upsert_failed", {
          signupRole,
          signupVia,
          errorMessage: profileError.message,
        });
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
      logAuthCallback("error", "post_exchange_missing_user", {
        flow,
        tokenType,
      });
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

  logAuthCallback("info", "redirecting", {
    flow,
    tokenType,
    hasNext: Boolean(next),
    hasSignupRole: Boolean(signupRole),
    signupVia,
    destinationPath: new URL(destination).pathname,
  });

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
