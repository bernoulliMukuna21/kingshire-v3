import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  hasValidCurrencyPrecision,
  normalizeCurrencyAmount,
} from "@/lib/validation";

type ServiceInput = {
  name?: unknown;
  rate?: unknown;
  rate_type?: unknown;
};

const VALID_SERVICE_RATE_TYPES = ["per_hour", "per_day", "per_project"];

function getCookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

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
  const kcTrace = getCookieValue(request.headers.get("cookie"), "kc_trace");
  const supabase = await createClient();
  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  console.info("[complete-onboarding] getUser", {
    kcTrace,
    hasUser: Boolean(user),
    userId: user?.id ?? null,
    errorMessage: getUserError?.message ?? null,
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const body = await request.json();
  const { role, phone, service_tags, services, portfolio_url, cv_url } = body;

  console.info("[complete-onboarding] payload", {
    kcTrace,
    userId: user.id,
    role,
    hasPhone: Boolean(phone),
    serviceCount: Array.isArray(services) ? services.length : 0,
  });

  if (role !== "client" && role !== "kinglancer") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
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

  const db = createServiceClient();
  const { error, count } = await db
    .from("profiles")
    .update({
      role,
      phone: phone || null,
      services: role === "kinglancer" ? normalized.services : [],
      service_tags: role === "kinglancer" ? normalized.serviceTags : [],
      portfolio_url: portfolio_url || null,
      cv_url: cv_url || null,
    })
    .eq("id", user.id)
    .select("id, role");

  console.info("[complete-onboarding] db update result", {
    kcTrace,
    userId: user.id,
    hasError: Boolean(error),
    errorMessage: error?.message ?? null,
    errorCode: error?.code ?? null,
    count,
  });

  if (error) {
    console.error("[complete-onboarding]", error);
    return NextResponse.json(
      { error: "Failed to save profile" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
