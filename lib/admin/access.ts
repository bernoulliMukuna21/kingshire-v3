import { cache } from "react";
import { requireAdminPage } from "@/lib/admin-dashboard";
import { createServiceClient } from "@/lib/supabase/service";

/** Request-scoped only: never cache an administrator's authorization globally. */
export const getAdminDb = cache(async () => {
  await requireAdminPage();
  return createServiceClient();
});
