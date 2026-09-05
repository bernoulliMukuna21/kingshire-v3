/**
 * Payout links for manual worker payouts. The worker supplies a payment link on
 * a rail they control (Revolut, Monzo, PayPal, Wise); the admin funds that link
 * and the money reaches the worker's account. We store a link, never raw bank
 * numbers — lower sensitivity and worker-controlled.
 */

export const PAYOUT_PROVIDERS = [
  {
    id: "revolut",
    label: "Revolut",
    host: "revolut.me",
    example: "https://revolut.me/yourname",
  },
  {
    id: "monzo",
    label: "Monzo",
    host: "monzo.me",
    example: "https://monzo.me/yourname",
  },
  {
    id: "paypal",
    label: "PayPal",
    host: "paypal.me",
    example: "https://paypal.me/yourname",
  },
  {
    id: "wise",
    label: "Wise",
    host: "wise.com",
    example: "https://wise.com/pay/me/yourname",
  },
  { id: "other", label: "Other", host: null, example: "https://…" },
] as const;

export type PayoutProvider = (typeof PAYOUT_PROVIDERS)[number]["id"];

export function isPayoutProvider(value: string): value is PayoutProvider {
  return PAYOUT_PROVIDERS.some((p) => p.id === value);
}

export function payoutProviderLabel(id: string) {
  return PAYOUT_PROVIDERS.find((p) => p.id === id)?.label ?? id;
}

type ValidateResult = { ok: true; link: string } | { ok: false; error: string };

/**
 * Validates a payout link: must be an https URL, within a sane length, and —
 * for a known provider — hosted on that provider's domain (so the admin never
 * clicks an arbitrary link that claims to be, say, PayPal).
 */
export function validatePayoutLink(
  provider: string,
  rawLink: string,
): ValidateResult {
  if (!isPayoutProvider(provider)) {
    return { ok: false, error: "Choose a valid payout provider." };
  }
  const link = rawLink.trim();
  if (!link) return { ok: false, error: "Enter your payout link." };
  if (link.length > 300) {
    return { ok: false, error: "That link is too long." };
  }

  let url: URL;
  try {
    url = new URL(link);
  } catch {
    return { ok: false, error: "Enter a valid link (including https://)." };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "The link must start with https://" };
  }

  const config = PAYOUT_PROVIDERS.find((p) => p.id === provider)!;
  if (config.host) {
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== config.host) {
      return {
        ok: false,
        error: `A ${config.label} link should be on ${config.host}.`,
      };
    }
  }

  return { ok: true, link: url.toString() };
}
