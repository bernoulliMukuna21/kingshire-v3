const endpoint = process.argv[2];

if (!endpoint?.startsWith("/api/cron/")) {
  console.error("Usage: node scripts/run-cron.mjs /api/cron/<job>");
  process.exit(1);
}

const appUrl =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : undefined);

if (!appUrl) {
  console.error(
    "Missing APP_URL or NEXT_PUBLIC_APP_URL. Set it to your deployed app URL.",
  );
  process.exit(1);
}

if (!process.env.CRON_SECRET) {
  console.error("Missing CRON_SECRET.");
  process.exit(1);
}

const url = new URL(endpoint, appUrl);

const response = await fetch(url, {
  method: "GET",
  headers: {
    Authorization: `Bearer ${process.env.CRON_SECRET}`,
  },
});

const body = await response.text();
console.log(`[cron] ${endpoint} -> ${response.status}`);
if (body) console.log(body);

if (!response.ok) {
  process.exit(1);
}
