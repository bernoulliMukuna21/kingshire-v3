import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoleHome } from "@/lib/roles";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export const proxy = async (request: NextRequest) => {
  const { supabase, ctx } = createProxyClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

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
