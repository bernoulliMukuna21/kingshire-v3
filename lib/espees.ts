// Espees (ESP) merchant API client — inbound payments.
//
// Flow: create a product (returns a payment_ref) → redirect the payer to the
// hosted Espees pay page → confirm the payment_ref server-side. There is no
// webhook, so callers confirm on redirect-back and a reconciliation job polls
// anything left PENDING. The x-api-key is a secret; it lives only in env.

const API_BASE = process.env.ESPEES_API_BASE ?? "https://api.espees.org";
const PAY_BASE = process.env.ESPEES_PAY_BASE ?? "https://payment.espees.org";

// Whether the Espees rail is configured (used to gate the payment option).
export function espeesConfigured(): boolean {
  return Boolean(process.env.ESPEES_API_KEY && process.env.ESPEES_MERCHANT_WALLET);
}

// The hosted pay page for a payment reference (to resume an existing attempt).
export function espeesPayUrl(paymentRef: string): string {
  return `${PAY_BASE}/pay/${paymentRef}`;
}

function requireConfig(): { apiKey: string; merchantWallet: string } {
  const apiKey = process.env.ESPEES_API_KEY;
  const merchantWallet = process.env.ESPEES_MERCHANT_WALLET;
  if (!apiKey || !merchantWallet) {
    throw new Error("Espees is not configured (ESPEES_API_KEY / ESPEES_MERCHANT_WALLET).");
  }
  return { apiKey, merchantWallet };
}

export type EspeesConfirmStatus =
  | "APPROVED"
  | "DECLINE"
  | "PENDING"
  | "NOT_FOUND"
  | "UNKNOWN";

export type CreateEspeesProductResult = {
  paymentRef: string;
  payUrl: string;
};

// Create a payable product. `priceEsp` is the amount in ESP (see lib/espees-fx).
export async function createEspeesProduct(args: {
  productSku: string;
  narration: string;
  priceEsp: number;
  successUrl: string;
  failUrl: string;
  userData?: Record<string, string>;
}): Promise<CreateEspeesProductResult> {
  const { apiKey, merchantWallet } = requireConfig();

  const res = await fetch(`${API_BASE}/v2/payment/product`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
    body: JSON.stringify({
      product_sku: args.productSku,
      narration: args.narration,
      price: args.priceEsp,
      merchant_wallet: merchantWallet,
      success_url: args.successUrl,
      fail_url: args.failUrl,
      user_data: args.userData ?? {},
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    payment_ref?: string;
    message?: string;
  };

  if (!res.ok || !body.payment_ref) {
    throw new Error(
      `Espees product creation failed: ${body.message ?? res.status}`,
    );
  }

  return {
    paymentRef: body.payment_ref,
    payUrl: `${PAY_BASE}/pay/${body.payment_ref}`,
  };
}

function normaliseStatus(raw: unknown): EspeesConfirmStatus {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "APPROVED") return "APPROVED";
  if (s === "DECLINE" || s === "DECLINED") return "DECLINE";
  if (s === "PENDING") return "PENDING";
  if (s === "NOT_FOUND") return "NOT_FOUND";
  return "UNKNOWN";
}

export type EspeesConfirmResult = {
  status: EspeesConfirmStatus;
  raw: unknown;
};

// Confirm a payment by its reference. Safe to call repeatedly (idempotent read).
export async function confirmEspeesPayment(
  paymentRef: string,
): Promise<EspeesConfirmResult> {
  const { apiKey } = requireConfig();

  const res = await fetch(`${API_BASE}/v2/payment/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    cache: "no-store",
    body: JSON.stringify({ payment_ref: paymentRef }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    transaction_status?: string;
  };

  if (!res.ok) {
    // A 404-style body still tells us the payment isn't found; otherwise unknown.
    return { status: normaliseStatus(body.transaction_status), raw: body };
  }

  return { status: normaliseStatus(body.transaction_status), raw: body };
}
