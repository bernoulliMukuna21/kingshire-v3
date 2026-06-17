import { handleKingsChatCallback } from "@/lib/kingschat-auth";

// POST /api/auth/kingschat/callback
// Future redirect_url once updated in the KingsChat developer portal.
// For now, KingsChat posts to /auth/callback instead (see app/auth/callback/route.ts).
export async function POST(request: Request) {
  return handleKingsChatCallback(request);
}
