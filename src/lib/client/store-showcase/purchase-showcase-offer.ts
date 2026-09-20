export type ShowcasePurchaseInput = Readonly<{
  offerId: string;
  expectedPrice: number;
}>;

type EconomyPurchaseErrorPayload = Readonly<{
  error?: unknown;
  message?: unknown;
  currentPrice?: unknown;
}>;

export class ShowcasePurchaseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number | null,
    public readonly currentPrice: number | null,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ShowcasePurchaseError";
  }
}

const attemptsByQuote = new Map<string, string>();

function quoteKey(offerId: string, expectedPrice: number) {
  return `${offerId}:${expectedPrice}`;
}

function idempotencyKeyFor(offerId: string, expectedPrice: number) {
  const key = quoteKey(offerId, expectedPrice);
  const current = attemptsByQuote.get(key);
  if (current) return { key, idempotencyKey: current };

  const idempotencyKey = crypto.randomUUID();
  attemptsByQuote.set(key, idempotencyKey);
  return { key, idempotencyKey };
}

async function responsePayload(response: Response): Promise<EconomyPurchaseErrorPayload> {
  try {
    const payload = await response.json();
    return payload && typeof payload === "object"
      ? (payload as EconomyPurchaseErrorPayload)
      : {};
  } catch {
    return {};
  }
}

function normalizedError(
  payload: EconomyPurchaseErrorPayload,
  status: number,
  retryable: boolean,
) {
  const code = typeof payload.error === "string" ? payload.error : "ECONOMY_PURCHASE_FAILED";
  const message =
    typeof payload.message === "string"
      ? payload.message
      : retryable
        ? "A compra não pôde ser confirmada. Tente novamente."
        : "A compra foi recusada pelo servidor.";
  const currentPrice =
    Number.isSafeInteger(payload.currentPrice) && (payload.currentPrice as number) >= 0
      ? (payload.currentPrice as number)
      : null;

  return new ShowcasePurchaseError(code, message, status, currentPrice, retryable);
}

export async function purchaseShowcaseOffer({
  offerId,
  expectedPrice,
}: ShowcasePurchaseInput) {
  const { key, idempotencyKey } = idempotencyKeyFor(offerId, expectedPrice);

  let response: Response;
  try {
    response = await fetch("/api/economy/purchases", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        offerId,
        idempotencyKey,
        expectedPrice,
      }),
    });
  } catch (cause) {
    throw new ShowcasePurchaseError(
      "ECONOMY_NETWORK_UNCERTAIN",
      cause instanceof Error ? cause.message : "Falha de rede durante a compra.",
      null,
      null,
      true,
    );
  }

  const payload = await responsePayload(response);
  if (response.ok) {
    attemptsByQuote.delete(key);
    return payload;
  }

  const retryable = response.status >= 500;
  if (!retryable) attemptsByQuote.delete(key);
  throw normalizedError(payload, response.status, retryable);
}
