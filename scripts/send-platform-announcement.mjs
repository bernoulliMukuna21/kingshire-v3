// One-off platform announcement email to every user.
//
// SAFETY: dry-run by default (prints who WOULD receive it, sends nothing).
//   Preview recipients:   node scripts/send-platform-announcement.mjs
//   Send to yourself:     node scripts/send-platform-announcement.mjs --test=you@example.com
//   Send for real:        node scripts/send-platform-announcement.mjs --live
//   Cap the batch:        node scripts/send-platform-announcement.mjs --live --limit=50
//
// Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, BREVO_API_KEY,
// BREVO_SENDER_EMAIL (and optionally BREVO_SENDER_NAME, NEXT_PUBLIC_APP_URL).

import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const isLive = args.includes("--live");
const isPreview = args.includes("--preview");
const testArg = args.find((a) => a.startsWith("--test="));
const testEmail = testArg ? testArg.split("=")[1]?.trim() : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kingshire.uk";
const SUPPORT_EMAIL = "kingshirecompany@gmail.com";
const SUBJECT = "What's new on KingsHire: organisations, placements & more";

const requiredEnv = [
  // The DB read (dry-run + live) needs Supabase; --test/--preview skip it.
  ...(testEmail || isPreview
    ? []
    : ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]),
  // Any actual send needs Brevo.
  ...(isLive || testEmail ? ["BREVO_API_KEY", "BREVO_SENDER_EMAIL"] : []),
];
const missing = requiredEnv.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(", ")}`);
  process.exit(1);
}

// ── Announcement copy (edit freely) ───────────────────────────────────────
function emailHtml(firstName) {
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";
  return `<!doctype html>
<html><body style="margin:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eef2f7">
        <tr><td style="background:#ffffff;padding:20px 32px;border-bottom:1px solid #eef2f7">
          <img src="${APP_URL}/logo.png" alt="KingsHire" width="160" style="display:block;height:auto;border:0;outline:none;text-decoration:none" />
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 16px;color:#334155;line-height:1.7;font-size:15px">${greeting}</p>
          <p style="margin:0 0 16px;color:#334155;line-height:1.7;font-size:15px">A quick note on a few things we&apos;ve added to KingsHire recently:</p>
          <ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.8;font-size:15px">
            <li>You can now bring your team into a shared <a href="${APP_URL}/organisation" style="color:#10234b">Organisations</a> workspace to post and manage jobs together, with roles and shared billing.</li>
            <li>We&apos;ve added <a href="${APP_URL}/placements" style="color:#10234b">placements and internships</a> — supervised roles that build real experience and earn a verified Placement Passport on your profile.</li>
            <li><strong>For Kinglancers</strong> — you can now get paid by a payment link you control (Revolut, Monzo, PayPal or Wise); add yours in <a href="${APP_URL}/dashboard/settings" style="color:#10234b">your settings</a>. Automatic Stripe payouts are available too.</li>
            <li><strong>For clients and organisations</strong> — you can pay by bank transfer with no card fee, and jobs now start from just £10.</li>
          </ul>
          <p style="margin:0 0 16px;color:#334155;line-height:1.7;font-size:15px">We&apos;ve also refreshed our <a href="${APP_URL}/terms" style="color:#10234b">Terms of Service</a> — worth a quick look.</p>
          <p style="margin:0;color:#334155;line-height:1.7;font-size:15px">Thanks for being part of it,<br/>The KingsHire team</p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #f1f5f9;text-align:center">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:12px">&copy; 2026 KingsHire &middot; <a href="${APP_URL}" style="color:#94a3b8">kingshire.uk</a></p>
          <p style="margin:0;color:#94a3b8;font-size:12px">Questions or want to opt out? Email <a href="mailto:${SUPPORT_EMAIL}" style="color:#94a3b8">${SUPPORT_EMAIL}</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function firstNameOf(fullName) {
  if (!fullName) return null;
  return String(fullName).trim().split(/\s+/)[0] || null;
}

async function sendOne(email, fullName) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": process.env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME ?? "KingsHire",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email }],
      subject: SUBJECT,
      htmlContent: emailHtml(firstNameOf(fullName)),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${text}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function recipients() {
  // Test mode: a single hardcoded address, no DB read.
  if (testEmail) return [{ email: testEmail, full_name: null }];

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
  );
  const byEmail = new Map();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("email, full_name")
      .not("email", "is", null)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data?.length) break;
    for (const row of data) {
      const email = row.email?.trim().toLowerCase();
      if (email && !byEmail.has(email)) byEmail.set(email, row.full_name);
    }
    if (data.length < pageSize) break;
  }
  return [...byEmail].map(([email, full_name]) => ({ email, full_name }));
}

async function main() {
  if (isPreview) {
    const fs = await import("node:fs");
    fs.writeFileSync("announcement-preview.html", emailHtml("Bernoulli"));
    console.log("Wrote announcement-preview.html — open it in a browser.");
    return;
  }

  const list = (await recipients()).slice(0, limit);
  console.log(`Recipients: ${list.length}`);

  if (!isLive && !testEmail) {
    console.log("DRY RUN — nothing sent. Re-run with --live to send.");
    console.log(
      "Sample:",
      list.slice(0, 10).map((r) => r.email),
    );
    return;
  }

  let sent = 0;
  let failed = 0;
  for (const r of list) {
    try {
      await sendOne(r.email, r.full_name);
      sent += 1;
      if (sent % 25 === 0) console.log(`  sent ${sent}/${list.length}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${r.email}: ${err.message}`);
    }
    await sleep(250); // gentle pacing for Brevo
  }
  console.log(`Done. Sent ${sent}, failed ${failed}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
