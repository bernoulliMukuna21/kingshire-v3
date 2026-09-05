import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";

type ServiceInput = {
  name?: unknown;
  rate?: unknown;
  rate_type?: unknown;
};

const VALID_SERVICE_RATE_TYPES = ["per_hour", "per_day", "per_project"];

function normalizeServices(services: unknown, serviceTags: unknown) {
  const rawServices = Array.isArray(services)
    ? services
    : Array.isArray(serviceTags)
      ? serviceTags.map((name) => ({ name, rate: 0, rate_type: "per_hour" }))
      : [];

  const seen = new Set<string>();
  const normalizedServices = [];

  for (const service of rawServices as ServiceInput[]) {
    const name = String(service.name ?? "").trim();
    if (!name) continue;
    if (name.length > 80) {
      return { error: "Service names must be 80 characters or fewer." };
    }

    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const rateRaw =
      service.rate === "" || service.rate == null ? 0 : service.rate;
    const rateValue =
      typeof rateRaw === "string" || typeof rateRaw === "number" ? rateRaw : "";
    const rate = Number(rateRaw);
    if (
      !Number.isFinite(rate) ||
      rate < 0 ||
      rate > 50000 ||
      !hasValidCurrencyPrecision(rateValue)
    ) {
      return {
        error: "Service rates must be valid amounts with up to 2 decimals.",
      };
    }

    const rateType = VALID_SERVICE_RATE_TYPES.includes(
      String(service.rate_type),
    )
      ? String(service.rate_type)
      : "per_hour";

    normalizedServices.push({
      name,
      rate: normalizeCurrencyAmount(rate),
      rate_type: rateType,
    });
  }

  return {
    services: normalizedServices,
    serviceTags: normalizedServices.map((service) => service.name),
  };
}

// POST /api/profile/complete-onboarding
// Persists the onboarding form. Uses the service client so that the profile
// trigger does not revert the `role` field (the trigger blocks authenticated-
// role writes to system-managed columns, but service role bypasses it).
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { role, phone, service_tags, services, portfolio_url, cv_url, bio } =
    body;

  if (role !== "client" && role !== "kinglancer") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (role === "kinglancer") {
    const bioValue = typeof bio === "string" ? bio.trim() : "";
    if (!bioValue) {
      return NextResponse.json(
        { error: "Please add an 'About you' section." },
        { status: 400 },
      );
    }
    if (bioValue.length > 500) {
      return NextResponse.json(
        { error: "About you must be 500 characters or fewer." },
        { status: 400 },
      );
    }
  }
  const normalized = normalizeServices(services, service_tags);

  if ("error" in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 });
  }

  if (role === "kinglancer" && normalized.services.length === 0) {
    return NextResponse.json(
      { error: "Please select at least one service." },
      { status: 400 },
    );
  }

  if (role === "kinglancer" && !normalized.services.some((s) => s.rate > 0)) {
    return NextResponse.json(
      { error: "Please set a rate for at least one service." },
      { status: 400 },
    );
  }

  const db = createServiceClient();
  const bioValue = typeof bio === "string" ? bio.trim() : null;
  const { error } = await db
    .from("profiles")
    .update({
      role,
      phone: phone || null,
      bio: role === "kinglancer" ? bioValue || null : undefined,
      services: role === "kinglancer" ? normalized.services : [],
      service_tags: role === "kinglancer" ? normalized.serviceTags : [],
      portfolio_url: portfolio_url || null,
      cv_url: cv_url || null,
      // New users agree to the current terms at sign-up — record it so they
      // aren't re-prompted immediately.
      terms_accepted_version: CURRENT_TERMS_VERSION,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select("id, role");

  if (error) {
    console.error("[complete-onboarding]", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
