import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoleHome } from "@/lib/roles";

export const config = {
  matcher: [
    "/((?!api|auth/callback|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export const proxy = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;
  const kcTrace = request.cookies.get("kc_trace")?.value ?? null;
  const hasAuthCookie = request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    );
  const onAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  const protectedPrefixes = [
    "/dashboard",
    "/jobs/post",
    "/jobs/request",
    "/onboarding",
    "/reset-password",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));

  if (!onAuthPage && !isProtected) {
    return NextResponse.next({ request });
  }

  if (kcTrace || pathname === "/onboarding" || pathname === "/sign-in") {
    console.info("[proxy/auth] request", {
      pathname,
      kcTrace,
      onAuthPage,
      isProtected,
      hasAuthCookie,
    });
  }

  const { supabase, ctx } = createProxyClient(request);
  const { user } = await getProxyUser(supabase, pathname, kcTrace);

  // Logged-in users visiting auth pages → send to their dashboard
  if (user && onAuthPage) {
    if (kcTrace) {
      console.info("[proxy/auth] redirect_logged_in_user", {
        pathname,
        kcTrace,
        userId: user.id,
      });
    }
    return redirectLoggedInUser(supabase, user.id, request);
  }

  // Protected routes → must be logged in
  if (!user && isProtected) {
    if (kcTrace || pathname === "/onboarding") {
      console.warn("[proxy/auth] redirect_to_sign_in", {
        pathname,
        kcTrace,
        hasAuthCookie,
      });
    }
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return ctx.response;
};

const getProxyUser = async (
  supabase: SupabaseClient,
  pathname: string,
  kcTrace: string | null,
) => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      const isMissingSession = error.message === "Auth session missing!";
      if (!isMissingSession) {
        console.warn("[proxy/auth]", "get_user_failed", {
          pathname,
          kcTrace,
          code: "code" in error ? error.code : undefined,
          status: "status" in error ? error.status : undefined,
          message: error.message,
        });
      }
    }

    if (kcTrace || pathname === "/onboarding" || pathname === "/sign-in") {
      console.info("[proxy/auth] get_user_result", {
        pathname,
        kcTrace,
        hasUser: Boolean(data.user),
        userId: data.user?.id ?? null,
        errorMessage: error?.message ?? null,
      });
    }

    return { user: data.user };
  } catch (error) {
    console.warn("[proxy/auth]", "get_user_threw", {
      pathname,
      kcTrace,
      message: error instanceof Error ? error.message : "Unknown auth error",
    });
    return { user: null };
  }
};

const createProxyClient = (request: NextRequest) => {
  const ctx = { response: NextResponse.next({ request }) };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          ctx.response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            ctx.response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, ctx };
};

const redirectLoggedInUser = async (
  supabase: SupabaseClient,
  userId: string,
  request: NextRequest,
) => {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return NextResponse.redirect(new URL(getRoleHome(profile.role), request.url));
};
