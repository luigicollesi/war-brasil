import "server-only";

import type {
  CampaignCreditWallet,
  CosmeticCatalogItem,
  CosmeticLoadout,
  CosmeticSet,
  CosmeticSlot,
  EconomyStorefrontSnapshot,
  EquipCosmeticInput,
} from "@/src/lib/economy/economy-contract";
import {
  COSMETIC_SLOTS,
  ECONOMY_CURRENCY_ID,
  isCosmeticSlot,
} from "@/src/lib/economy/economy-contract";
import { diceAssetDeliveryPath } from "../assets/asset-storage-service";
import { pool } from "../db/pool";
import {
  equipOwnedCosmetic,
  findCampaignCreditWallet,
  findOwnedCosmetic,
  initializeEconomyState,
  listOwnedCosmetics,
  listStorefrontSetItems,
  lockCommanderEconomyState,
  type CosmeticRow,
  type EconomyQueryable,
} from "./economy-repository";

export class EconomyServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "EconomyServiceError";
  }
}

function projectedAssetRef(row: CosmeticRow) {
  if (!row.asset_ref) return null;
  if (
    row.slot !== "territory_effect" &&
    row.asset_ref.startsWith("cosmetics/dice/")
  ) {
    return diceAssetDeliveryPath(row.asset_ref);
  }
  return row.asset_ref;
}

function cosmeticFromRow(row: CosmeticRow): CosmeticCatalogItem {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    slot: row.slot,
    rarity: row.rarity,
    status: row.status,
    isDefault: row.is_default,
    owned: row.owned,
    equipped: row.equipped,
    previewRef: row.preview_ref,
    assetRef: projectedAssetRef(row),
    effectKey: row.effect_key,
  };
}

function walletFromRow(
  row: Awaited<ReturnType<typeof findCampaignCreditWallet>>,
): CampaignCreditWallet {
  if (!row) {
    throw new EconomyServiceError(
      "ECONOMY_WALLET_MISSING",
      "A carteira do comandante não pôde ser inicializada.",
      503,
    );
  }

  const balance = Number(row.balance);
  if (!Number.isSafeInteger(balance) || balance < 0) {
    throw new EconomyServiceError(
      "ECONOMY_WALLET_INVALID",
      "O saldo persistido da carteira é inválido.",
      503,
    );
  }

  return {
    currency: ECONOMY_CURRENCY_ID,
    label: "Créditos de Campanha",
    shortLabel: "CRÉDITOS",
    symbol: "◈",
    balance,
  };
}

function loadoutFromOwned(rows: CosmeticRow[]): CosmeticLoadout {
  const entries = COSMETIC_SLOTS.map((slot) => {
    const equipped = rows.find((row) => row.slot === slot && row.equipped);
    const fallback = rows.find((row) => row.slot === slot && row.is_default);
    const resolved = equipped ?? fallback;

    if (!resolved) {
      throw new EconomyServiceError(
        "ECONOMY_LOADOUT_INCOMPLETE",
        `Nenhum cosmético seguro está disponível para o slot ${slot}.`,
        503,
      );
    }

    return [slot, cosmeticFromRow(resolved)] as const;
  });

  return Object.fromEntries(entries) as unknown as CosmeticLoadout;
}

function setsFromRows(
  rows: Awaited<ReturnType<typeof listStorefrontSetItems>>,
): CosmeticSet[] {
  const grouped = new Map<string, CosmeticSet>();

  for (const row of rows) {
    const current = grouped.get(row.set_id);
    const item = cosmeticFromRow(row);
    if (current) {
      grouped.set(row.set_id, { ...current, items: [...current.items, item] });
      continue;
    }

    grouped.set(row.set_id, {
      id: row.set_id,
      slug: row.set_slug,
      name: row.set_name,
      description: row.set_description,
      status: row.set_status,
      previewRef: row.set_preview_ref,
      items: [item],
    });
  }

  return [...grouped.values()];
}

async function ensureLockedEconomyState(
  userId: string,
  db: EconomyQueryable,
) {
  const commanderExists = await lockCommanderEconomyState(userId, db);
  if (!commanderExists) {
    throw new EconomyServiceError(
      "ECONOMY_COMMANDER_MISSING",
      "A identidade de comandante precisa existir antes da economia.",
      409,
    );
  }
  await initializeEconomyState(userId, db);
}

export async function ensureEconomyState(
  userId: string,
  db?: EconomyQueryable,
) {
  if (db) {
    await ensureLockedEconomyState(userId, db);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getEconomyStorefront(
  userId: string,
): Promise<EconomyStorefrontSnapshot> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);

    const [walletRow, ownedRows, setRows] = await Promise.all([
      findCampaignCreditWallet(userId, client),
      listOwnedCosmetics(userId, client),
      listStorefrontSetItems(userId, client),
    ]);

    const snapshot = {
      wallet: walletFromRow(walletRow),
      loadout: loadoutFromOwned(ownedRows),
      ownedItems: ownedRows.map(cosmeticFromRow),
      sets: setsFromRows(setRows),
    } satisfies EconomyStorefrontSnapshot;

    await client.query("COMMIT");
    return snapshot;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function parseEquipCosmeticInput(payload: unknown): EquipCosmeticInput {
  if (!payload || typeof payload !== "object") {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_SELECTION",
      "Seleção de cosmético inválida.",
      400,
    );
  }

  const input = payload as Record<string, unknown>;
  const cosmeticId = typeof input.cosmeticId === "string" ? input.cosmeticId.trim() : "";
  if (!isCosmeticSlot(input.slot) || !cosmeticId || cosmeticId.length > 160) {
    throw new EconomyServiceError(
      "ECONOMY_INVALID_SELECTION",
      "Slot ou cosmético inválido.",
      400,
    );
  }

  return { slot: input.slot, cosmeticId };
}

export async function equipCosmetic(
  userId: string,
  slot: CosmeticSlot,
  cosmeticId: string,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await ensureLockedEconomyState(userId, client);

    const item = await findOwnedCosmetic(userId, cosmeticId, client);
    if (!item) {
      throw new EconomyServiceError(
        "ECONOMY_COSMETIC_NOT_OWNED",
        "O comandante não possui esse cosmético.",
        403,
      );
    }

    if (item.slot !== slot) {
      throw new EconomyServiceError(
        "ECONOMY_SLOT_MISMATCH",
        "O cosmético não é compatível com esse slot.",
        400,
      );
    }

    if (item.status !== "available") {
      throw new EconomyServiceError(
        "ECONOMY_COSMETIC_NOT_EQUIPPABLE",
        "Esse cosmético não está disponível para nova equipagem.",
        409,
      );
    }

    await equipOwnedCosmetic(userId, slot, cosmeticId, client);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
