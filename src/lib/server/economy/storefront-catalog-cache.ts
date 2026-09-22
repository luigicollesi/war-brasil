import "server-only";

import { runPostResponseTask } from "../cloudflare/post-response-task";
import {
  listStorefrontCampaigns,
  listStorefrontCreditPacks,
  listStorefrontOffers,
  type CreditPackRow,
  type StorefrontCampaignRow,
  type StorefrontOfferRow,
} from "./economy-storefront-repository";
import {
  listActiveStorefrontOfferProducts,
  type StorefrontOfferProductRow,
} from "./storefront-quote-repository";

const STOREFRONT_CATALOG_CACHE_KEY =
  "https://cache.internal.bellumcivile/economy/storefront/catalog-v1";
const STOREFRONT_CATALOG_CACHE_SECONDS = 10;

export type StorefrontCatalogSnapshot = Readonly<{
  offerRows: StorefrontOfferRow[];
  productRows: StorefrontOfferProductRow[];
  campaignRows: StorefrontCampaignRow[];
  creditPackRows: CreditPackRow[];
}>;

async function loadFreshStorefrontCatalog(): Promise<StorefrontCatalogSnapshot> {
  const [offerRows, productRows, campaignRows, creditPackRows] =
    await Promise.all([
      listStorefrontOffers(),
      listActiveStorefrontOfferProducts(),
      listStorefrontCampaigns(),
      listStorefrontCreditPacks(),
    ]);

  return { offerRows, productRows, campaignRows, creditPackRows };
}

function cacheApi(): Cache | null {
  const cachesApi = (globalThis as typeof globalThis & {
    caches?: CacheStorage & { default?: Cache };
  }).caches;
  return cachesApi?.default ?? null;
}

function deserializeCatalog(value: StorefrontCatalogSnapshot) {
  return {
    ...value,
    productRows: value.productRows.map((row) => ({
      ...row,
      starts_at: row.starts_at ? new Date(row.starts_at) : null,
      ends_at: row.ends_at ? new Date(row.ends_at) : null,
    })),
  } satisfies StorefrontCatalogSnapshot;
}

export async function getStorefrontCatalogSnapshot(
  options: Readonly<{ bypassCache?: boolean }> = {},
): Promise<StorefrontCatalogSnapshot> {
  const cache = options.bypassCache ? null : cacheApi();
  const cacheKey = new Request(STOREFRONT_CATALOG_CACHE_KEY);

  if (cache) {
    const hit = await cache.match(cacheKey);
    if (hit?.ok) {
      try {
        return deserializeCatalog(
          (await hit.json()) as StorefrontCatalogSnapshot,
        );
      } catch {
        await cache.delete(cacheKey);
      }
    }
  }

  const snapshot = await loadFreshStorefrontCatalog();

  if (cache) {
    const response = Response.json(snapshot, {
      headers: {
        "Cache-Control": `public, max-age=${STOREFRONT_CATALOG_CACHE_SECONDS}`,
      },
    });
    await runPostResponseTask("economy.storefront.catalog-cache", () =>
      cache.put(cacheKey, response),
    );
  }

  return snapshot;
}
