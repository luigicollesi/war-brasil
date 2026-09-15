export const ASSET_STORAGE_ENV = "ASSET_STORAGE_URL" as const;
export const ASSET_STORAGE_BUCKET = "war-brasil-assets-prod" as const;
export const ASSET_STORAGE_REGION = "auto" as const;

export const DICE_ASSET_ROLES = ["attack", "defense", "neutral"] as const;
export type DiceAssetRole = (typeof DICE_ASSET_ROLES)[number];

export type AssetStorageConfig = Readonly<{
  accessKeyId: string;
  secretAccessKey: string;
  host: string;
  endpoint: string;
  bucket: string;
  region: string;
}>;

export class AssetStorageConfigError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "AssetStorageConfigError";
  }
}

function configError(code: string, message: string): never {
  throw new AssetStorageConfigError(code, message);
}

function decodeCredential(value: string, label: string) {
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded) configError("ASSET_STORAGE_URL_INVALID", `${label} ausente na configuração de assets.`);
    return decoded;
  } catch {
    return configError(
      "ASSET_STORAGE_URL_INVALID",
      `${label} possui encoding inválido na configuração de assets.`,
    );
  }
}

export function parseAssetStorageUrl(value: string | undefined): AssetStorageConfig {
  if (!value?.trim()) {
    return configError(
      "ASSET_STORAGE_URL_MISSING",
      "ASSET_STORAGE_URL não está configurada.",
    );
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return configError(
      "ASSET_STORAGE_URL_INVALID",
      "ASSET_STORAGE_URL possui formato inválido.",
    );
  }

  if (url.protocol !== "s3:") {
    return configError(
      "ASSET_STORAGE_URL_INVALID_PROTOCOL",
      "ASSET_STORAGE_URL deve usar o protocolo s3://.",
    );
  }

  if (url.port || url.hash) {
    return configError(
      "ASSET_STORAGE_URL_INVALID",
      "ASSET_STORAGE_URL contém componentes não suportados.",
    );
  }

  const host = url.hostname.toLowerCase();
  if (!/^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/.test(host)) {
    return configError(
      "ASSET_STORAGE_URL_INVALID_ENDPOINT",
      "ASSET_STORAGE_URL deve apontar para um endpoint Cloudflare R2 válido.",
    );
  }

  const accessKeyId = decodeCredential(url.username, "Access Key ID");
  const secretAccessKey = decodeCredential(url.password, "Secret Access Key");

  let bucket: string;
  try {
    bucket = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/g, ""));
  } catch {
    return configError(
      "ASSET_STORAGE_URL_INVALID_BUCKET",
      "ASSET_STORAGE_URL possui bucket inválido.",
    );
  }

  if (!bucket || bucket.includes("/") || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    return configError(
      "ASSET_STORAGE_URL_INVALID_BUCKET",
      "ASSET_STORAGE_URL possui bucket inválido.",
    );
  }

  const parameters = [...url.searchParams.keys()];
  if (parameters.some((name) => name !== "region") || url.searchParams.getAll("region").length !== 1) {
    return configError(
      "ASSET_STORAGE_URL_INVALID_QUERY",
      "ASSET_STORAGE_URL deve definir somente region=auto.",
    );
  }

  const region = url.searchParams.get("region");
  if (region !== ASSET_STORAGE_REGION) {
    return configError(
      "ASSET_STORAGE_URL_INVALID_REGION",
      "ASSET_STORAGE_URL deve utilizar region=auto para Cloudflare R2.",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    host,
    endpoint: `https://${host}`,
    bucket,
    region,
  };
}

export function assetStorageConfigFromEnv(
  env: Pick<NodeJS.ProcessEnv, "ASSET_STORAGE_URL"> = process.env,
): AssetStorageConfig {
  const config = parseAssetStorageUrl(env.ASSET_STORAGE_URL);
  if (config.bucket !== ASSET_STORAGE_BUCKET) {
    return configError(
      "ASSET_STORAGE_URL_UNEXPECTED_BUCKET",
      `O bucket configurado deve ser ${ASSET_STORAGE_BUCKET}.`,
    );
  }
  return config;
}

export function diceAssetKey(storageSlug: string, role: DiceAssetRole) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(storageSlug)) {
    return configError(
      "DICE_STORAGE_SLUG_INVALID",
      "O storage slug do conjunto de dados é inválido.",
    );
  }
  return `cosmetics/dice/${storageSlug}/${role}.webp` as const;
}

export function isDiceAssetKey(value: string): boolean {
  return /^cosmetics\/dice\/[a-z0-9]+(?:-[a-z0-9]+)*\/(?:attack|defense|neutral)\.webp$/.test(value);
}

export function assertDiceAssetKey(value: string): string {
  if (!isDiceAssetKey(value)) {
    return configError(
      "DICE_ASSET_KEY_INVALID",
      "A referência de dado deve apontar para attack.webp, defense.webp ou neutral.webp no namespace cosmetics/dice/.",
    );
  }
  return value;
}

export function diceCollectionAssetKeys(storageSlug: string) {
  return DICE_ASSET_ROLES.map((role) => diceAssetKey(storageSlug, role));
}
