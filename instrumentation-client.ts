import posthog from "posthog-js";
import { createClient } from "@/lib/supabase/client";

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (projectToken && host) {
  posthog.init(projectToken, {
    api_host: host,
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    tracing_headers: [window.location.hostname],
  });

  let identifiedUserId: string | null = null;

  const identifyUser = (user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string };
  }) => {
    if (identifiedUserId === user.id) return;

    if (identifiedUserId) posthog.reset();

    posthog.identify(user.id, {
      email: user.email,
      name: user.user_metadata?.full_name,
    });
    identifiedUserId = user.id;
  };

  const supabase = createClient();
  void supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) identifyUser(user);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      identifiedUserId = null;
      posthog.reset();
    } else if (session?.user) {
      identifyUser(session.user);
    }
  });
} else if (process.env.NODE_ENV === "development") {
  const missingVariable = !projectToken
    ? "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN"
    : "NEXT_PUBLIC_POSTHOG_HOST";
  throw new Error(
    `${missingVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingVariable} is configured`,
  );
}
