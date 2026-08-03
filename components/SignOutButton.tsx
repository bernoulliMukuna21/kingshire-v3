"use client";

import { createClient } from "@/lib/supabase/client";
import posthog from "posthog-js";
import { Button } from "@/components/ui/Button";

type Props = {
  className?: string;
  onSignOut?: () => void;
};

export default function SignOutButton({ className = "", onSignOut }: Props) {
  const handleSignOut = async () => {
    const supabase = createClient();
    await fetch("/api/admin/session", { method: "DELETE" }).catch(() => null);
    await supabase.auth.signOut();
    posthog.reset();
    onSignOut?.();
    window.location.href = "/sign-in";
  };

  return (
    <Button
      type="button"
      onClick={handleSignOut}
      variant="danger"
      className={className}
    >
      Sign out
    </Button>
  );
}
