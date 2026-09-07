// GBP → ESP conversion for the Espees payment rail.
//
// Espees is USD-pegged (1 ESP = $ESP_USD_RATE, default 1.60) but the platform
// prices jobs in GBP, so the chain is GBP → USD → ESP. ESP↔USD is fixed; only
// GBP→USD floats, which we pull from a free, no-key FX source (frankfurter.app,
// ECB data) and cache. A small buffer protects us against rate drift between
// charging the client and paying out.
//
//   esp = gbp × (usd per gbp) ÷ (usd per esp) × (1 + buffer)

const ESP_USD_RATE = Number(process.env.ESP_USD_RATE ?? "1.60"); // USD per 1 ESP
const FX_BUFFER = Number(process.env.ESPEES_FX_BUFFER ?? "0.02"); // 2%
const GBP_USD_FALLBACK = Number(process.env.GBP_USD_FALLBACK ?? "1.25");
const FX_TTL_MS = 12 * 60 * 60 * 1000; // refresh twice a day

let cachedRate: { usdPerGbp: number; fetchedAt: number } | null = null;

// Pure conversion — no network — so the maths is unit-testable in isolation.
export function computeEspees(args: {
  gbp: number;
  usdPerGbp: number;
  usdPerEsp: number;
  buffer: number;
}): number {
  const { gbp, usdPerGbp, usdPerEsp, buffer } = args;
  const esp = ((gbp * usdPerGbp) / usdPerEsp) * (1 + buffer);
  return Math.round(esp * 100) / 100;
}

// Current GBP→USD rate, cached, with a configured fallback if the source is
// unreachable (payments must not fail because an FX API is down).
export async function getGbpToUsd(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt < FX_TTL_MS) {
    return cachedRate.usdPerGbp;
  }
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=GBP&to=USD", {
      // Never cache at the fetch layer; we manage freshness ourselves.
      cache: "no-store",
    });
    if (res.ok) {
      const body = (await res.json()) as { rates?: { USD?: number } };
      const usd = body.rates?.USD;
      if (typeof usd === "number" && usd > 0) {
        cachedRate = { usdPerGbp: usd, fetchedAt: Date.now() };
        return usd;
      }
    }
  } catch {
    // fall through to the fallback rate
  }
  return GBP_USD_FALLBACK;
}

export type EspeesQuote = {
  esp: number;
  usdPerGbp: number;
  usdPerEsp: number;
  buffer: number;
};

// Convert a GBP amount to the ESP amount to charge, with the live rate + buffer.
export async function gbpToEspees(gbp: number): Promise<EspeesQuote> {
  const usdPerGbp = await getGbpToUsd();
  const esp = computeEspees({
    gbp,
    usdPerGbp,
    usdPerEsp: ESP_USD_RATE,
    buffer: FX_BUFFER,
  });
  return { esp, usdPerGbp, usdPerEsp: ESP_USD_RATE, buffer: FX_BUFFER };
}
