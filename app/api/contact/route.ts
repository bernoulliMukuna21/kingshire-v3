import { createHmac } from "node:crypto";
import { after, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { enquirySchema, deriveEnquiryView } from "@/lib/support/view";
import { sendEmail } from "@/lib/notifications/core";

async function submitEnquiry(request: Request) {
  const origin = request.headers.get("origin");
  const appOrigin = new URL(process.env.APP_URL || request.url).origin;
  if (
    !origin ||
    (origin !== appOrigin && origin !== new URL(request.url).origin)
  )
    return NextResponse.json(
      { error: "Please send your message from the contact page." },
      { status: 403 },
    );
  const text = await request.text();
  if (text.length > 16000)
    return NextResponse.json(
      { error: "Your message is too long." },
      { status: 413 },
    );
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Please check your message and try again." },
      { status: 400 },
    );
  }
  const parsed = enquirySchema.safeParse(raw);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check the form." },
      { status: 400 },
    );
  const input = parsed.data;
  if (input.website)
    return NextResponse.json(
      { error: "Your message could not be sent." },
      { status: 400 },
    );
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    return NextResponse.json(
      {
        error: `We couldn’t save your message. Please email ${SUPPORT_EMAIL}.`,
      },
      { status: 503 },
    );
  // No raw IP is stored. A database limit works across web server instances.
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const senderHash = createHmac("sha256", secret).update(ip).digest("hex");
  const db = createServiceClient();
  const { data, error } = await db.rpc("submit_support_enquiry", {
    p_id: input.id,
    p_topic: input.topic,
    p_name: input.name,
    p_email: input.email,
    p_organisation: input.organisation,
    p_reference: input.reference,
    p_message: input.message,
    p_source_path: input.sourcePath,
    p_sender_hash: senderHash,
  });
  if (error || !data) {
    const limited = error?.code === "P0001";
    console.error("[contact] submission failed", error?.code);
    return NextResponse.json(
      {
        error: limited
          ? `You’ve sent several messages recently. Please try again later, or email ${SUPPORT_EMAIL}.`
          : `We couldn’t save your message. Please try again or email ${SUPPORT_EMAIL}.`,
      },
      { status: limited ? 429 : 503 },
    );
  }
  // The saved inbox record is the source of truth. A mail outage cannot lose it.
  const claimed = await db
    .from("support_enquiries")
    .update({ inbox_email_claimed_at: new Date().toISOString() })
    .eq("id", data)
    .is("inbox_email_claimed_at", null)
    .select("id,topic,name,email,organisation,reference,message")
    .maybeSingle();
  if (claimed.error)
    console.error("[contact] could not claim email alert", claimed.error.code);
  const enquiry = claimed.data;
  if (enquiry)
    after(async () => {
      const view = deriveEnquiryView(enquiry.topic);
      const results = await Promise.allSettled([
        sendEmail({
          to: SUPPORT_EMAIL,
          subject: `KingsHire: ${view.label} · ${data.slice(0, 8)}`,
          title: view.label,
          body: `From: ${enquiry.name || "Anonymous"}${enquiry.email ? ` (${enquiry.email})` : ""}\nOrganisation: ${enquiry.organisation || "Not provided"}\nReference: ${enquiry.reference || "Not provided"}\n\n${enquiry.message}`,
          link: `/admin/support#${data}`,
          ctaLabel: "Open enquiry",
        }),
        ...(enquiry.email
          ? [
              sendEmail({
                to: enquiry.email,
                subject: `KingsHire: message received · ${data.slice(0, 8).toUpperCase()}`,
                title: "We’ve received your message",
                body: `${view.success}\n\nYour reference: ${data.slice(0, 8).toUpperCase()}`,
                recipientName: enquiry.name || undefined,
              }),
            ]
          : []),
      ]);
      if (results.some((result) => result.status === "rejected"))
        console.error(
          "[contact] inbox alert email failed; enquiry remains saved",
          data,
        );
    });
  return NextResponse.json({ id: data }, { status: 201 });
}

export async function POST(request: Request) {
  try {
    return await submitEnquiry(request);
  } catch {
    console.error("[contact] submission unavailable");
    return NextResponse.json(
      {
        error: `We couldn’t save your message. Please try again or email ${SUPPORT_EMAIL}.`,
      },
      { status: 503 },
    );
  }
}
