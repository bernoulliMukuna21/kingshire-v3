import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canManageJob } from "@/lib/organisations";
import { JOB_ATTACHMENT_BUCKET, parseJobAttachment } from "@/lib/job-attachments";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createServiceClient();
  const { data: job, error } = await db.from("jobs")
    .select("id, client_id, organisation_id, invited_kinglancer_id, kinglancer_id, attachment")
    .eq("id", id).maybeSingle();
  if (error || !job) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  // Ordinary job descriptions are public. Direct requests are participant-only.
  if (job.invited_kinglancer_id) {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const { data: profile } = await auth.from("profiles").select("role").eq("id", user.id).maybeSingle();
    const allowed = user.id === job.invited_kinglancer_id || user.id === job.kinglancer_id ||
      profile?.role === "admin" || await canManageJob(job, user.id);
    if (!allowed) return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  const file = parseJobAttachment(job.attachment);
  if (!file || !job.organisation_id || !file.path.startsWith(`${job.organisation_id}/${job.id}/`))
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  const { data, error: downloadError } = await db.storage.from(JOB_ATTACHMENT_BUCKET).download(file.path);
  if (downloadError || !data) return NextResponse.json({ error: "Unable to download this document. Please try again." }, { status: 503 });
  return new Response(data, { headers: {
    "Content-Type": "application/octet-stream",
    "Content-Disposition": `attachment; filename="supporting-document"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
