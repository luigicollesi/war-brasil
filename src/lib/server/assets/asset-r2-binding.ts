import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

type BoundR2ObjectBody = {
  body: ReadableStream<Uint8Array>;
  httpEtag: string;
  size: number;
  writeHttpMetadata(headers: Headers): void;
};

type BoundR2Bucket = {
  get(key: string): Promise<BoundR2ObjectBody | null>;
};

function boundAssetBucket(): BoundR2Bucket | null {
  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    const binding = env.ASSET_STORAGE;
    if (
      binding &&
      typeof binding === "object" &&
      typeof (binding as { get?: unknown }).get === "function"
    ) {
      return binding as BoundR2Bucket;
    }
  } catch {
    // Node/local development keeps using the existing signed S3 fallback.
  }
  return null;
}

export async function readBoundAssetResponse(objectKey: string) {
  const bucket = boundAssetBucket();
  if (!bucket) return null;

  const object = await bucket.get(objectKey);
  if (!object) {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  headers.set("Content-Length", String(object.size));
  headers.set("Cache-Control", "private, max-age=300");

  return new Response(object.body, { status: 200, headers });
}
