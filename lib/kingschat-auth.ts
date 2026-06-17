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
  level: "info" | "error",
  event: string,
  details: Record<string, unknown> = {},
) {
  if (level === "info" && process.env.AUTH_DEBUG_LOGS !== "true") return;
  console[level]("[kingschat/callback]", event, details);
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

      // Create the profile row — role is null so they go through onboarding
      await db.from("profiles").upsert(
        {
          id: supabaseUserId,
          email: normalizedEmail,
          full_name: displayName,
          avatar_url: kcProfile.avatar ?? null,
          role: null,
        },
        { onConflict: "id" },
      );
    }
  } catch (err) {
    log("error", "user_lookup_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }

  // ── 5. Issue a Supabase session via magic-link ───────────────────────────
  // generateLink returns a hashed_token we pass to our own /auth/callback as
  // ?token_hash=...&type=magiclink. That route calls supabase.auth.verifyOtp()
  // server-side — the correct SSR approach.
  //
  // We do NOT redirect the browser to action_link (Supabase's /auth/v1/verify)
  // because newer GoTrue requires a POST+JSON body for that endpoint, not a GET.
  try {
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", supabaseUserId)
      .single();

    const destination = getRoleHome(profile?.role);

    // `origin` from KingsChat carries the `next` path we embedded in step 1.
    // Validate it is an internal path before trusting it to prevent open redirect.
    const safeNext =
      origin && origin.startsWith("/") && !origin.startsWith("//")
        ? origin
        : destination;

    const { data: linkData, error: linkError } =
      await db.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });

    if (linkError || !linkData?.properties?.hashed_token) {
      log("error", "generate_link_failed", { error: linkError?.message });
      return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
    }

    log("info", "redirecting_to_supabase_auth", {
      userId: supabaseUserId,
      destination: safeNext,
    });

    // Redirect to our own callback which verifies the token server-side
    const callbackUrl = new URL(`${appUrl}/auth/callback`);
    callbackUrl.searchParams.set("token_hash", linkData.properties.hashed_token);
    callbackUrl.searchParams.set("type", "magiclink");
    callbackUrl.searchParams.set("next", safeNext);

    return NextResponse.redirect(callbackUrl.toString());
  } catch (err) {
    log("error", "session_issue_exception", { err: String(err) });
    return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`);
  }
}
