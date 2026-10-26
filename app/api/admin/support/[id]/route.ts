import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hasValidAdminSession } from "@/lib/admin-auth";
import { enquiryStatuses } from "@/lib/support/view";
const schema = z.object({
  status: z.enum(enquiryStatuses),
  expectedStatus: z.enum(enquiryStatuses),
});
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile } = await session
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin" || !(await hasValidAdminSession(user.id)))
    return NextResponse.json(
      { error: "Admin access required." },
      { status: 403 },
    );
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "Choose a valid status." },
      { status: 400 },
    );
  const result = await createServiceClient()
    .from("support_enquiries")
    .update({ status: input.data.status })
    .eq("id", id)
    .eq("status", input.data.expectedStatus)
    .select("id")
    .maybeSingle();
  if (result.error)
    return NextResponse.json(
      { error: "Couldn’t update this enquiry. Please try again." },
      { status: 500 },
    );
  if (!result.data)
    return NextResponse.json(
      { error: "This enquiry changed. Refresh the page before updating it." },
      { status: 409 },
    );
  return NextResponse.json({ id });
}
