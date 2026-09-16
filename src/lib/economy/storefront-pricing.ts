const BASIS_POINTS = 10_000;

export type StorefrontPriceTier = Readonly<{
  acquisitionsFrom: number;
  acquisitionsUntil: number | null;
  price: number;
}>;

export type StorefrontItemPricing =
  | Readonly<{
      type: "fixed";
      price: number;
    }>
  | Readonly<{
      type: "progressive";
      acquisitionCount: number;
      tiers: ReadonlyArray<StorefrontPriceTier>;
    }>;

export type StorefrontQuoteItem = Readonly<{
  cosmeticId: string;
  owned: boolean;
  pricing: StorefrontItemPricing;
}>;

export type StorefrontProductQuote = Readonly<{
  subtotal: number;
  discountBps: number;
  basePrice: number;
  promotionDiscountBps: number;
  finalPrice: number;
  missingCosmeticIds: ReadonlyArray<string>;
  fullyOwned: boolean;
}>;

function requireSafeInteger(value: number, label: string, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${label} must be a safe integer >= ${minimum}.`);
  }
}

function requireBasisPoints(value: number, label: string) {
  requireSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} must be between 0 and ${BASIS_POINTS}.`);
  }
  return value;
}

function requirePositivePrice(price: number) {
  requireSafeInteger(price, "price", 1);
  return price;
}

function toSafeInteger(value: bigint, label: string) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${label} exceeds the supported safe integer range.`);
  }
  return Number(value);
}

function applyDiscount(value: bigint, discountBps: number) {
  return (value * BigInt(BASIS_POINTS - discountBps)) / BigInt(BASIS_POINTS);
}

function validatedTiers(tiers: ReadonlyArray<StorefrontPriceTier>) {
  if (tiers.length === 0) {
    throw new Error("At least one price tier is required.");
  }

  const ordered = [...tiers].sort(
    (left, right) => left.acquisitionsFrom - right.acquisitionsFrom,
  );

  for (let index = 0; index < ordered.length; index += 1) {
    const tier = ordered[index];
    requireSafeInteger(tier.acquisitionsFrom, "tier acquisitionsFrom");
    requirePositivePrice(tier.price);

    if (tier.acquisitionsUntil !== null) {
      requireSafeInteger(tier.acquisitionsUntil, "tier acquisitionsUntil");
      if (tier.acquisitionsUntil < tier.acquisitionsFrom) {
        throw new Error("Price tier end cannot precede its start.");
      }
    }

    const previous = index > 0 ? ordered[index - 1] : null;
    if (!previous) continue;

    if (previous.acquisitionsUntil === null) {
      throw new Error("An open-ended price tier must be the final tier.");
    }
    if (tier.acquisitionsFrom <= previous.acquisitionsUntil) {
      throw new Error("Price tier ranges overlap.");
    }
  }

  return ordered;
}

export function resolveProgressiveUnitPrice(
  acquisitionCount: number,
  tiers: ReadonlyArray<StorefrontPriceTier>,
) {
  requireSafeInteger(acquisitionCount, "acquisitionCount");

  const tier = validatedTiers(tiers).find(
    (candidate) =>
      acquisitionCount >= candidate.acquisitionsFrom &&
      (candidate.acquisitionsUntil === null ||
        acquisitionCount <= candidate.acquisitionsUntil),
  );

  if (!tier) {
    throw new Error(`No price tier covers acquisition count ${acquisitionCount}.`);
  }

  return tier.price;
}

export function resolveStorefrontUnitPrice(pricing: StorefrontItemPricing) {
  if (pricing.type === "fixed") {
    return requirePositivePrice(pricing.price);
  }

  return resolveProgressiveUnitPrice(pricing.acquisitionCount, pricing.tiers);
}

export function quoteStorefrontProduct(
  items: ReadonlyArray<StorefrontQuoteItem>,
  discountBps: number,
  promotionDiscountBps = 0,
): StorefrontProductQuote {
  requireBasisPoints(discountBps, "discount_bps");
  requireBasisPoints(promotionDiscountBps, "promotion_discount_bps");

  const missingItems = items.filter((item) => !item.owned);
  let subtotal = BigInt(0);

  for (const item of missingItems) {
    if (!item.cosmeticId.trim()) {
      throw new Error("cosmeticId is required for storefront pricing.");
    }
    subtotal += BigInt(resolveStorefrontUnitPrice(item.pricing));
  }

  const basePrice = applyDiscount(subtotal, discountBps);
  const finalPrice = applyDiscount(basePrice, promotionDiscountBps);

  return {
    subtotal: toSafeInteger(subtotal, "subtotal"),
    discountBps,
    basePrice: toSafeInteger(basePrice, "basePrice"),
    promotionDiscountBps,
    finalPrice: toSafeInteger(finalPrice, "finalPrice"),
    missingCosmeticIds: missingItems.map((item) => item.cosmeticId),
    fullyOwned: missingItems.length === 0,
  };
}
