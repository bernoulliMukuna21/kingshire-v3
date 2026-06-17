import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRoleHome } from "@/lib/roles";

// KingsChat profile shape from GET /developer/api/user/profile
type KingsChatProfile = {
  id: string;
  name: string;
  username: string;
  email: string | null;
  avatar: string | null;
  is_email_verified: boolean;
};

function log(
  level: "info" | "error" | "warn",
  event: string,
  details: Record<string, unknown> = {},
) {
  // Always log during KingsChat auth — remove gate once flow is stable
  console[level]("[kingschat/callback]", event, JSON.stringify(details));
}

/**
 * Core KingsChat OAuth callback handler.
 *
 * Called from two routes depending on which redirect_url is registered
 * in the KingsChat developer portal:
 *   - POST /auth/callback          (current: redirect_url = kingshire.uk/auth/callback)
 *   - POST /api/auth/kingschat/callback (future: after portal redirect_url is updated)
 *
 * Receives { code, origin } from KingsChat, exchanges the code for an
 * access token, fetches the user's KingsChat profile, finds or creates a
 * Supabase user, then issues a Supabase magic-link session so the user gets
 * a normal Supabase session — completely independent of KingsChat's token TTL.
 */
export async function handleKingsChatCallback(
  request: Request,
): Promise<NextResponse> {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;

  // ── 1. Parse incoming payload ────────────────────────────────────────────
  let code: string | undefined;
  let origin: string | undefined;

  try {
    const contentType = request.headers.get("content-type") ?? "";
    let body: Record<string, unknown>;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // KingsChat may POST as form-encoded rather than JSON
      const text = await request.text();
      const params = new URLSearchParams(text);
      body = Object.fromEntries(params.entries());
    } else if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      // Try JSON first, fall back to form-encoded
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        body = Object.fromEntries(params.entries());
      }
    }

    code = typeof body.code === "string" ? body.code : undefined;
    origin = typeof body.origin === "string" ? body.origin : undefined;
    log("info", "parsed_payload", { contentType, hasCode: Boolean(code), hasOrigin: Boolean(origin) });
  } catch {
    log("error", "invalid_payload", {});
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  if (!code) {
    log("error", "missing_code", {});
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  const clientId = process.env.KINGSCHAT_CLIENT_ID;
  const apiKey = process.env.KINGSCHAT_API_KEY;

  if (!clientId || !apiKey) {
    console.error(
      "[kingschat/callback] Missing KingsChat environment variables",
    );
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  // ── 2. Exchange code for access token ────────────────────────────────────
  let accessToken: string;

  try {
    const tokenRes = await fetch(
      "https://connect.kingsch.at/developer/api/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "code",
          client_id: clientId,
          code,
        }),
      },
    );

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      log("error", "token_exchange_failed", {
        status: tokenRes.status,
        body,
      });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      log("error", "no_access_token", { tokenData });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    accessToken = tokenData.access_token;
    // refresh_token and expires_in_millis are intentionally discarded.
    // Supabase owns the session lifecycle from this point forward.
  } catch (err) {
    log("error", "token_exchange_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  // ── 3. Fetch KingsChat profile ───────────────────────────────────────────
  let kcProfile: KingsChatProfile;

  try {
    const profileRes = await fetch(
      "https://connect.kingsch.at/developer/api/user/profile",
      {
        headers: {
          "api-key": apiKey,
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!profileRes.ok) {
      const body = await profileRes.text();
      log("error", "profile_fetch_failed", {
        status: profileRes.status,
        body,
      });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    const profileData = await profileRes.json();
    kcProfile = profileData.profile as KingsChatProfile;

    if (!kcProfile?.email) {
      // Without an email we cannot link to a Supabase user.
      log("error", "profile_missing_email", { kcId: kcProfile?.id });
      return NextResponse.redirect(
        `${appUrl}/sign-in?error=auth_failed&reason=no_email`,
      );
    }
  } catch (err) {
    log("error", "profile_fetch_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  log("info", "kc_profile_received", {
    kcId: kcProfile.id,
    hasAvatar: Boolean(kcProfile.avatar),
  });

  // ── 4. Find or create Supabase user ─────────────────────────────────────
  // Link by email — the standard practice for SSO providers.
  // An existing KingsHire account (password or Google) with the same email is
  // silently reused; no duplicate accounts are created.
  const db = createServiceClient();
  const normalizedEmail = kcProfile.email.trim().toLowerCase();
  const displayName =
    kcProfile.name?.trim() || normalizedEmail.split("@")[0];

  let supabaseUserId: string;

  try {
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id, avatar_url")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      supabaseUserId = existingProfile.id;
      log("info", "existing_user_found", { userId: supabaseUserId });

      // Backfill avatar if they signed up via email and have none
      if (kcProfile.avatar && !existingProfile.avatar_url) {
        await db
          .from("profiles")
          .update({ avatar_url: kcProfile.avatar })
          .eq("id", supabaseUserId);
      }
    } else {
      // New user — create the Supabase auth entry.
      // email_confirm: true skips the verification email; identity was
      // already proven by KingsChat's OAuth flow.
      const { data: newUser, error: createError } =
        await db.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: {
            full_name: displayName,
            avatar_url: kcProfile.avatar ?? null,
            kingschat_id: kcProfile.id,
          },
        });

      if (createError || !newUser?.user) {
        log("error", "create_user_failed", { error: createError?.message });
        return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
      }

      supabaseUserId = newUser.user.id;
      log("info", "new_user_created", { userId: supabaseUserId });

      // The on_auth_user_created trigger already inserted the profiles row.
      // We upsert here only to backfill avatar_url which the trigger doesn't set.
      const { error: upsertError } = await db.from("profiles").upsert(
        {
          id: supabaseUserId,
          email: normalizedEmail,
          full_name: displayName,
          avatar_url: kcProfile.avatar ?? null,
          role: null,
        },
        { onConflict: "id" },
      );
      if (upsertError) {
        log("error", "profile_upsert_failed", { error: upsertError.message });
        // Non-fatal: trigger already created the row, avatar will just be missing
      }
    }
  } catch (err) {
    log("error", "user_lookup_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  // ── 5. Issue a Supabase session directly in this request ─────────────────
  // Generate a magic-link OTP, then immediately verify it server-side using
  // the raw email_otp code. The SSR client writes the session cookies onto
  // the redirect response — no extra browser round-trip required.
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", supabaseUserId)
      .single();

    const destination = getRoleHome(profile?.role);

    // Validate `origin` from KingsChat to prevent open redirect.
    const safeNext =
      origin && origin.startsWith("/") && !origin.startsWith("//")
        ? origin
        : destination;

    const { data: linkData, error: linkError } =
      await db.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });

    // Log the full shape of what generateLink returned so we know exactly
    // which properties are present (email_otp, hashed_token, action_link, etc.)
    log("info", "generate_link_result", {
      hasError: Boolean(linkError),
      errorMessage: linkError?.message ?? null,
      propertiesKeys: linkData?.properties
        ? Object.keys(linkData.properties)
        : null,
      hasEmailOtp: Boolean(linkData?.properties?.email_otp),
      hasHashedToken: Boolean(linkData?.properties?.hashed_token),
      hasActionLink: Boolean(linkData?.properties?.action_link),
    });

    if (linkError || !linkData?.properties?.email_otp) {
      log("error", "generate_link_failed", { error: linkError?.message ?? "no email_otp in properties" });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    // Verify the OTP server-side immediately — no redirect to /auth/callback.
    // The SSR client captures the resulting session cookies.
    const pendingCookies: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];

    const ssrClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              pendingCookies.push({ name, value, options });
            });
          },
        },
      },
    );

    log("info", "otp_verify_attempt", {
      email: normalizedEmail,
      tokenLength: linkData.properties.email_otp.length,
    });

    const { data: otpData, error: otpError } = await ssrClient.auth.verifyOtp({
      email: normalizedEmail,
      token: linkData.properties.email_otp,
      type: "magiclink",
    });

    if (otpError) {
      log("error", "otp_verify_failed", {
        errorMessage: otpError.message,
        errorCode: (otpError as { code?: string }).code ?? null,
        errorStatus: (otpError as { status?: number }).status ?? null,
      });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    log("info", "otp_verify_success", {
      hasSession: Boolean(otpData?.session),
      hasUser: Boolean(otpData?.user),
    });

    log("info", "session_established", {
      userId: supabaseUserId,
      destination: safeNext,
      cookieCount: pendingCookies.length,
      cookieNames: pendingCookies.map((c) => c.name),
    });

    const response = NextResponse.redirect(`${appUrl}${safeNext}`);
    log("info", "redirect_target", { url: `${appUrl}${safeNext}` });
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      );
    });
    return response;
  } catch (err) {
    log("error", "session_issue_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }
}
