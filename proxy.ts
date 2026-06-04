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
  const { supabase, ctx } = createProxyClient(request);
  const { pathname } = request.nextUrl;
  const { user, authError } = await getProxyUser(supabase, pathname);

  if (authError) {
    clearSupabaseAuthCookies(ctx.response, request);
  }

  // Logged-in users visiting auth pages → send to their dashboard
  const onAuthPage = pathname === "/sign-in" || pathname === "/sign-up";
  if (user && onAuthPage) {
    return redirectLoggedInUser(supabase, user.id, request);
  }

  // Protected routes → must be logged in
  const protectedPrefixes = [
    "/dashboard",
    "/jobs/post",
    "/onboarding",
    "/reset-password",
  ];
  const isProtected = protectedPrefixes.some((p) => pathname.startsWith(p));
  if (!user && isProtected) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return ctx.response;
};

const getProxyUser = async (supabase: SupabaseClient, pathname: string) => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.warn("[proxy/auth]", "get_user_failed", {
        pathname,
        code: "code" in error ? error.code : undefined,
        status: "status" in error ? error.status : undefined,
        message: error.message,
      });
    }

    return { user: data.user, authError: error };
  } catch (error) {
    console.warn("[proxy/auth]", "get_user_threw", {
      pathname,
      message: error instanceof Error ? error.message : "Unknown auth error",
    });
    return { user: null, authError: error };
  }
};

const clearSupabaseAuthCookies = (
  response: NextResponse,
  request: NextRequest,
) => {
  request.cookies
    .getAll()
    .filter(
      (cookie) =>
        cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"),
    )
    .forEach((cookie) => {
      response.cookies.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
      });
    });
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

  return NextResponse.redirect(
    new URL(getRoleHome(profile.role), request.url),
  );
};
