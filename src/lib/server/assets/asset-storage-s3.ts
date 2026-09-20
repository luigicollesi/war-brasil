import { createHash, createHmac } from "node:crypto";
import type { AssetStorageConfig } from "./asset-storage-config";
import {
  assertDiceAssetKey,
  assertTerritorySkinAssetKey,
  diceCollectionAssetKeys,
} from "./asset-storage-config";

const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";
const SIGNING_SERVICE = "s3";
const SIGNING_TERMINATOR = "aws4_request";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";
const DEFAULT_EXPIRY_SECONDS = 300;
const MAX_EXPIRY_SECONDS = 900;

export type AssetStorageHttpMethod = "GET" | "HEAD";

export class AssetStorageRequestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AssetStorageRequestError";
  }
}

function requestError(code: string, message: string): never {
  throw new AssetStorageRequestError(code, message);
}

function awsEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function canonicalObjectPath(bucket: string, objectKey: string) {
  return `/${[bucket, ...objectKey.split("/")].map(awsEncode).join("/")}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string) {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function signingKey(secret: string, dateStamp: string, region: string) {
  const dateKey = hmac(`AWS4${secret}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, SIGNING_SERVICE);
  return hmac(serviceKey, SIGNING_TERMINATOR);
}

function amzTimestamp(date: Date) {
  if (!Number.isFinite(date.getTime())) {
    return requestError("ASSET_STORAGE_DATE_INVALID", "Data inválida para assinatura do asset.");
  }
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function canonicalQuery(parameters: Record<string, string>) {
  return Object.entries(parameters)
    .map(([key, value]) => [awsEncode(key), awsEncode(value)] as const)
    .sort(([keyA, valueA], [keyB, valueB]) => {
      const keyComparison = keyA.localeCompare(keyB);
      return keyComparison !== 0 ? keyComparison : valueA.localeCompare(valueB);
    })
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function normalizeExpiry(value: number | undefined) {
  const expiry = value ?? DEFAULT_EXPIRY_SECONDS;
  if (!Number.isSafeInteger(expiry) || expiry < 1 || expiry > MAX_EXPIRY_SECONDS) {
    return requestError(
      "ASSET_STORAGE_EXPIRY_INVALID",
      `A expiração do asset deve estar entre 1 e ${MAX_EXPIRY_SECONDS} segundos.`,
    );
  }
  return expiry;
}

export function createPresignedAssetUrl(
  config: AssetStorageConfig,
  objectKey: string,
  options: Readonly<{
    method?: AssetStorageHttpMethod;
    expiresInSeconds?: number;
    now?: Date;
  }> = {},
) {
  const method = options.method ?? "GET";
  const expiry = normalizeExpiry(options.expiresInSeconds);
  const timestamp = amzTimestamp(options.now ?? new Date());
  const dateStamp = timestamp.slice(0, 8);
  const credentialScope = `${dateStamp}/${config.region}/${SIGNING_SERVICE}/${SIGNING_TERMINATOR}`;
  const canonicalUri = canonicalObjectPath(config.bucket, objectKey);
  const query = canonicalQuery({
    "X-Amz-Algorithm": SIGNING_ALGORITHM,
    "X-Amz-Credential": `${config.accessKeyId}/${credentialScope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(expiry),
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalHeaders = `host:${config.host}\n`;
  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    canonicalHeaders,
    "host",
    UNSIGNED_PAYLOAD,
  ].join("\n");
  const stringToSign = [
    SIGNING_ALGORITHM,
    timestamp,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(config.secretAccessKey, dateStamp, config.region))
    .update(stringToSign, "utf8")
    .digest("hex");

  return `${config.endpoint}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

export function createPresignedDiceAssetUrl(
  config: AssetStorageConfig,
  objectKey: string,
  options?: Readonly<{
    method?: AssetStorageHttpMethod;
    expiresInSeconds?: number;
    now?: Date;
  }>,
) {
  return createPresignedAssetUrl(config, assertDiceAssetKey(objectKey), options);
}

export type WebPAssetObjectMetadata = Readonly<{
  objectKey: string;
  contentType: "image/webp";
  contentLength: number | null;
  etag: string | null;
}>;

export type DiceAssetObjectMetadata = WebPAssetObjectMetadata;
export type TerritorySkinAssetObjectMetadata = WebPAssetObjectMetadata;

export async function validateWebPAssetObject(
  config: AssetStorageConfig,
  objectKey: string,
  options: Readonly<{
    assertKey: (value: string) => string;
    unavailableCode: string;
    contentTypeCode: string;
    label: string;
  }>,
  fetchImpl: typeof fetch,
): Promise<WebPAssetObjectMetadata> {
  const key = options.assertKey(objectKey);
  const signedUrl = createPresignedAssetUrl(config, key, {
    method: "HEAD",
    expiresInSeconds: 60,
  });
  const response = await fetchImpl(signedUrl, { method: "HEAD", cache: "no-store" });

  if (!response.ok) {
    return requestError(
      options.unavailableCode,
      `${options.label} ${key} não está disponível no object storage.`,
    );
  }

  const contentType = response.headers
    .get("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (contentType !== "image/webp") {
    return requestError(
      options.contentTypeCode,
      `${options.label} ${key} deve possuir Content-Type image/webp.`,
    );
  }

  const lengthHeader = response.headers.get("content-length");
  const parsedLength = lengthHeader === null ? null : Number(lengthHeader);
  const contentLength =
    parsedLength !== null && Number.isSafeInteger(parsedLength) && parsedLength >= 0
      ? parsedLength
      : null;

  return {
    objectKey: key,
    contentType: "image/webp",
    contentLength,
    etag: response.headers.get("etag"),
  };
}

export async function validateDiceAssetObject(
  config: AssetStorageConfig,
  objectKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiceAssetObjectMetadata> {
  return validateWebPAssetObject(
    config,
    objectKey,
    {
      assertKey: assertDiceAssetKey,
      unavailableCode: "DICE_ASSET_NOT_AVAILABLE",
      contentTypeCode: "DICE_ASSET_CONTENT_TYPE_INVALID",
      label: "O asset",
    },
    fetchImpl,
  );
}

export async function validateTerritorySkinAssetObject(
  config: AssetStorageConfig,
  objectKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<TerritorySkinAssetObjectMetadata> {
  return validateWebPAssetObject(
    config,
    objectKey,
    {
      assertKey: assertTerritorySkinAssetKey,
      unavailableCode: "TERRITORY_SKIN_ASSET_NOT_AVAILABLE",
      contentTypeCode: "TERRITORY_SKIN_ASSET_CONTENT_TYPE_INVALID",
      label: "A territory skin",
    },
    fetchImpl,
  );
}

export async function validateDiceCollection(
  config: AssetStorageConfig,
  storageSlug: string,
  fetchImpl: typeof fetch = fetch,
) {
  const keys = diceCollectionAssetKeys(storageSlug);
  const metadata = await Promise.all(
    keys.map((objectKey) => validateDiceAssetObject(config, objectKey, fetchImpl)),
  );
  return { storageSlug, keys, metadata } as const;
}
