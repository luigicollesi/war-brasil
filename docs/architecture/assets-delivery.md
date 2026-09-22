# Asset Delivery Architecture

Status: implemented production contract.

## Goals

- keep public image reads off the OpenNext application Worker;
- keep PostgreSQL free of environment-specific asset URLs;
- use Cloudflare R2 bindings for Worker-side reads without network authentication;
- keep S3 credentials outside the production Worker runtime;
- make public/private asset boundaries explicit.

## Production read path

```text
PostgreSQL object key
        |
        v
assetDeliveryPath()
        |
        +---- ASSET_PUBLIC_BASE_URL configured
        |             |
        |             v
        |   assets.bellumcivile.com/<object-key>
        |             |
        |        Cloudflare Cache
        |             |
        |             v
        |             R2
        |
        +---- no public base URL
                      |
                      v
             /api/assets/* fallback
                      |
                 authenticated
                      |
                      v
                R2 binding
                      |
               Node/local only
                      |
                      v
              signed S3 fallback
```

The browser never receives R2 API credentials.

## Security boundaries

### Public assets

`war-brasil-assets-prod` is a public-delivery bucket. Anything stored in this
bucket must be safe to expose to an unauthenticated user that knows the object
key.

Do not store private documents, user uploads that require authorization,
secrets, receipts, moderation evidence or other protected data in this bucket.

CORS is a browser-origin policy, not an authorization mechanism.

### Worker access

The production Worker uses the `ASSET_STORAGE` R2 binding. The binding is the
capability boundary and does not require an API token or S3 access key inside
the Worker.

### Tooling and local development

`ASSET_STORAGE_URL`, `ASSET_STORAGE_ACCESS_KEY_ID` and
`ASSET_STORAGE_SECRET_ACCESS_KEY` are reserved for Node/local tooling,
validation scripts and S3-compatible access outside the production Worker.

### Future protected assets

Do not add a browser-visible shared secret to the public CDN.

If protected downloads become necessary, use a separate private bucket and one
of these boundaries:

1. Worker-authenticated reads through an R2 binding;
2. short-lived S3 presigned URLs when CDN/custom-domain caching is not required;
3. a dedicated protected custom domain with WAF HMAC validation when the
   Cloudflare plan supports it.

Protected delivery must not be enabled globally for public cosmetic images.

## Component ownership

- `public-asset-url.ts`: normalizes and caches the public base URL.
- `asset-delivery.ts`: shared object-key -> public CDN/fallback projection.
- `asset-fallback-route.ts`: shared authenticated fallback with binding-first
  R2 reads.
- domain storage modules: validate their own object-key namespace and delegate
  delivery to `asset-delivery.ts`.
- PostgreSQL: stores stable object keys only.

## Cache policy

Public URLs should not carry per-user tokens, cookies or signatures. This keeps
the cache key stable across players.

Until object names are content-versioned, use bounded TTLs and purge a specific
URL or prefix after overwriting an existing R2 key.

For future immutable assets prefer versioned/fingerprinted object keys, then a
long-lived immutable cache policy can be used safely.

## Operational rules

- custom domain: `assets.bellumcivile.com`;
- production bucket: `war-brasil-assets-prod`;
- production CORS policy: `config/r2-cors.production.json`;
- enable Cache Rules for the asset hostname;
- enable Smart Tiered Cache when available;
- after replacing an object at the same key, purge that URL/prefix;
- never use `r2.dev` as the production delivery path.
