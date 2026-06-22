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
  console[level]("[kingschat/callback]", event, JSON.stringify(details));
}

function createTraceId() {
  return `kc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// This handler is reached via a cross-site POST. Redirects must use 303 So the
// browser follows them with a GET — otherwise the default 307 preserves POST,
// which both re-POSTs the target page (405) and drops SameSite=Lax cookies.
function authFailedRedirect(appUrl: string) {
  return NextResponse.redirect(`${appUrl}/sign-in?error=auth_failed`, 303);
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
  const traceId = createTraceId();
  const startedAt = Date.now();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin;

  log("info", "start", {
    traceId,
    method: request.method,
    url: request.url,
    appUrl,
  });

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
    log("info", "parsed_payload", {
      traceId,
      contentType,
      hasCode: Boolean(code),
      hasOrigin: Boolean(origin),
      origin,
    });
  } catch {
    log("error", "invalid_payload", { traceId });
    return authFailedRedirect(appUrl);
  }

  if (!code) {
    log("error", "missing_code", { traceId });
    return authFailedRedirect(appUrl);
  }

  const clientId = process.env.KINGSCHAT_CLIENT_ID;
  const apiKey = process.env.KINGSCHAT_API_KEY;

  if (!clientId || !apiKey) {
    console.error(
      "[kingschat/callback] Missing KingsChat environment variables",
    );
    return authFailedRedirect(appUrl);
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
      log("error", "token_exchange_failed", {
        traceId,
        status: tokenRes.status,
      });
      return authFailedRedirect(appUrl);
    }

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      log("error", "no_access_token", {
        traceId,
        responseKeys: Object.keys(tokenData ?? {}),
      });
      return authFailedRedirect(appUrl);
    }

    accessToken = tokenData.access_token;
    // refresh_token and expires_in_millis are intentionally discarded.
    // Supabase owns the session lifecycle from this point forward.
  } catch (err) {
    log("error", "token_exchange_exception", { traceId, err: String(err) });
    return authFailedRedirect(appUrl);
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
      log("error", "profile_fetch_failed", {
        traceId,
        status: profileRes.status,
      });
      return authFailedRedirect(appUrl);
    }

    const profileData = await profileRes.json();
    kcProfile = profileData.profile as KingsChatProfile;

    if (!kcProfile?.email) {
      // Without an email we cannot link to a Supabase user.
      log("error", "profile_missing_email", { traceId });
      return NextResponse.redirect(
        `${appUrl}/sign-in?error=auth_failed&reason=no_email`,
        303,
      );
    }

    // Strict account-takeover guard. We link KingsChat to a Supabase account
    // purely by email, so the email MUST be proven to belong to this user.
    // Without this, anyone holding a KingsChat account that reports an
    // unverified email could be signed in as the KingsHire user who owns it.
    if (kcProfile.is_email_verified !== true) {
      log("warn", "email_unverified", { traceId });
      return NextResponse.redirect(
        `${appUrl}/sign-in?error=auth_failed&reason=email_unverified`,
        303,
      );
    }
  } catch (err) {
    log("error", "profile_fetch_exception", { traceId, err: String(err) });
    return authFailedRedirect(appUrl);
  }

  log("info", "kc_profile_received", {
    traceId,
    hasAvatar: Boolean(kcProfile.avatar),
  });

  // ── 4. Ensure Supabase auth user exists ──────────────────────────────────
  // We only need to create the user if they're brand new. If they already
  // exist in auth.users (regardless of whether a profiles row exists), the
  // generateLink call in step 5 will work fine — it looks up by email.
  // We therefore only call createUser when there's no profile row AND there's
  // no auth user (the error from createUser will tell us which case we're in).
  const db = createServiceClient();
  const normalizedEmail = kcProfile.email.trim().toLowerCase();
  const displayName = kcProfile.name?.trim() || normalizedEmail.split("@")[0];

  try {
    const { data: existingProfile } = await db
      .from("profiles")
      .select("id, avatar_url")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      log("info", "existing_user_found", { traceId });
      // Backfill avatar if missing
      if (kcProfile.avatar && !existingProfile.avatar_url) {
        await db
          .from("profiles")
          .update({ avatar_url: kcProfile.avatar })
          .eq("id", existingProfile.id);
      }
    } else {
      // No profile row. Try to create the auth user.
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

      if (createError) {
        // "User already registered" means an auth user exists but has no profile.
        // That's fine — generateLink in step 5 will still work by email.
        // Any other error is fatal.
        const isAlreadyExists =
          createError.message.toLowerCase().includes("already") ||
          createError.message.toLowerCase().includes("duplicate") ||
          createError.message.toLowerCase().includes("registered");

        log(isAlreadyExists ? "info" : "error", "create_user_result", {
          traceId,
          alreadyExists: isAlreadyExists,
          error: createError.message,
        });

        if (!isAlreadyExists) {
          return authFailedRedirect(appUrl);
        }
        // If already exists: continue — generateLink will still work.
      } else if (newUser?.user) {
        log("info", "new_user_created", { traceId });
        // Trigger already inserted the profile row; upsert only to add avatar_url.
        const { error: upsertError } = await db.from("profiles").upsert(
          {
            id: newUser.user.id,
            email: normalizedEmail,
            full_name: displayName,
            avatar_url: kcProfile.avatar ?? null,
            role: null,
          },
          { onConflict: "id" },
        );
        if (upsertError) {
          log("error", "profile_upsert_failed", {
            traceId,
            error: upsertError.message,
          });
        }
      }
    }
  } catch (err) {
    log("error", "user_lookup_exception", { traceId, err: String(err) });
    return authFailedRedirect(appUrl);
  }

  // ── 5. Issue a Supabase session directly in this request ─────────────────
  // Generate a magic-link OTP for the email, verify it server-side, collect
  // the session cookies, and attach them to the redirect response.
  //
  // IMPORTANT: we use otpData.user.id (the session user) as the canonical ID,
  // NOT the ID we may have computed in step 4. If duplicate auth users existed
  // from earlier failed attempts, generateLink will resolve to one of them —
  // using the session user ensures the profile and session are always in sync.
  try {
    const { data: linkData, error: linkError } =
      await db.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });

    log("info", "generate_link_result", {
      traceId,
      hasError: Boolean(linkError),
      errorMessage: linkError?.message ?? null,
      propertiesKeys: linkData?.properties
        ? Object.keys(linkData.properties)
        : null,
      hasEmailOtp: Boolean(linkData?.properties?.email_otp),
    });

    if (linkError || !linkData?.properties?.email_otp) {
      log("error", "generate_link_failed", {
        traceId,
        error: linkError?.message ?? "no email_otp in properties",
      });
      return authFailedRedirect(appUrl);
    }

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
      traceId,
      tokenLength: linkData.properties.email_otp.length,
    });

    const { data: otpData, error: otpError } = await ssrClient.auth.verifyOtp({
      email: normalizedEmail,
      token: linkData.properties.email_otp,
      type: "magiclink",
    });

    if (otpError || !otpData?.user) {
      log("error", "otp_verify_failed", {
        traceId,
        errorMessage: otpError?.message ?? "no user in otp response",
        errorCode: (otpError as { code?: string })?.code ?? null,
        errorStatus: (otpError as { status?: number })?.status ?? null,
      });
      return authFailedRedirect(appUrl);
    }

    // Use the session user's ID as canonical — not the pre-computed one.
    const sessionUserId = otpData.user.id;
    log("info", "otp_verify_success", {
      traceId,
      hasSession: Boolean(otpData.session),
    });

    // Ensure profile row exists for the session user and get their role.
    // This is the safety net for orphaned auth users (auth user exists, no profile).
    const { data: sessionProfile } = await db
      .from("profiles")
      .select("role")
      .eq("id", sessionUserId)
      .maybeSingle();

    if (!sessionProfile) {
      log("info", "creating_missing_profile", { traceId });
      const { error: missingProfileUpsertError } = await db
        .from("profiles")
        .upsert(
          {
            id: sessionUserId,
            email: normalizedEmail,
            full_name: displayName,
            avatar_url: kcProfile.avatar ?? null,
            role: null,
          },
          { onConflict: "id" },
        );
      if (missingProfileUpsertError) {
        log("error", "creating_missing_profile_failed", {
          traceId,
          error: missingProfileUpsertError.message,
        });
        return authFailedRedirect(appUrl);
      }
    }

    const destination = getRoleHome(sessionProfile?.role ?? null);
    const safeNext = !sessionProfile?.role
      ? "/onboarding"
      : origin &&
          origin.startsWith("/") &&
          !origin.startsWith("//") &&
          origin !== "/"
        ? origin
        : destination;

    log("info", "session_established", {
      traceId,
      destination: safeNext,
      cookieCount: pendingCookies.length,
      elapsedMs: Date.now() - startedAt,
    });

    // 303 See Other forces the browser to follow the redirect with a GET.
    // KingsChat hits this handler via a cross-site POST; the default 307 would
    // preserve the POST method, and SameSite=Lax auth cookies are NOT sent on
    // POST navigations — so the session would be invisible to middleware and
    // the user bounced to /sign-in. A GET navigation carries the Lax cookies.
    const response = NextResponse.redirect(`${appUrl}${safeNext}`, 303);

    log("info", "redirect_target", {
      traceId,
      url: `${appUrl}${safeNext}`,
    });
    pendingCookies.forEach(({ name, value, options }) => {
      response.cookies.set(
        name,
        value,
        options as Parameters<typeof response.cookies.set>[2],
      );
    });
    return response;
  } catch (err) {
    log("error", "session_issue_exception", { traceId, err: String(err) });
    return authFailedRedirect(appUrl);
  }
}
