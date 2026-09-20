import "server-only";

import type {
  CommanderBackgroundAppearance,
  CommanderTitleAppearance,
  ProfileAppearanceSnapshot,
  ProfileAppearanceUpdate,
  PublicCommanderBackgroundAppearance,
  PublicCommanderTitleAppearance,
} from "@/src/lib/profile/profile-appearance-contract";
import { pool } from "../db/pool";
import {
  ensureDefaultProfileBackgroundOwnership,
  findPublicCommanderAppearance,
  listOwnedCommanderBackgroundAppearance,
  listOwnedCommanderTitleAppearance,
  lockCommanderAppearanceState,
  ownsActiveCommanderTitle,
  ownsActiveProfileBackground,
  updateCommanderAppearance,
  type ProfileAppearanceQueryable,
} from "./profile-appearance-repository";
import { profileAppearanceAssetDeliveryPath } from "./profile-appearance-asset-storage";

const APPEARANCE_ID_MAX_LENGTH = 160;

export class ProfileAppearanceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "ProfileAppearanceError";
  }
}

function titleFromRow(
  row: Awaited<ReturnType<typeof listOwnedCommanderTitleAppearance>>[number],
): CommanderTitleAppearance {
  return {
    id: row.id,
    name: row.name,
    displayText: row.display_text,
    description: row.description,
    rarity: row.rarity,
    fontKey: row.font_key,
    styleKey: row.style_key,
    textureRef: row.texture_ref
      ? profileAppearanceAssetDeliveryPath(row.texture_ref)
      : null,
    isActive: row.is_active,
    equipped: row.equipped,
  };
}

function backgroundFromRow(
  row: Awaited<ReturnType<typeof listOwnedCommanderBackgroundAppearance>>[number],
): CommanderBackgroundAppearance {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    rarity: row.rarity,
    assetRef: profileAppearanceAssetDeliveryPath(row.asset_ref),
    previewRef: row.preview_ref
      ? profileAppearanceAssetDeliveryPath(row.preview_ref)
      : null,
    isDefault: row.is_default,
    isActive: row.is_active,
    equipped: row.equipped,
  };
}

export async function ensureProfileAppearanceState(
  userId: string,
  db?: ProfileAppearanceQueryable,
) {
  if (db) {
    return ensureDefaultProfileBackgroundOwnership(userId, db);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const backgroundId = await ensureDefaultProfileBackgroundOwnership(
      userId,
      client,
    );
    if (!backgroundId) {
      throw new ProfileAppearanceError(
        "PROFILE_BACKGROUND_DEFAULT_MISSING",
        "O background padrão do perfil não está configurado.",
        503,
      );
    }
    await client.query("COMMIT");
    return backgroundId;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getOwnProfileAppearance(
  userId: string,
): Promise<ProfileAppearanceSnapshot> {
  const [titles, backgrounds] = await Promise.all([
    listOwnedCommanderTitleAppearance(userId),
    listOwnedCommanderBackgroundAppearance(userId),
  ]);

  const equippedBackground = backgrounds.find((item) => item.equipped);
  if (!equippedBackground) {
    throw new ProfileAppearanceError(
      "PROFILE_BACKGROUND_NOT_EQUIPPED",
      "O comandante não possui um background de perfil equipado.",
      503,
    );
  }

  return {
    equippedTitleId: titles.find((item) => item.equipped)?.id ?? null,
    equippedBackgroundId: equippedBackground.id,
    titles: titles.map(titleFromRow),
    backgrounds: backgrounds.map(backgroundFromRow),
  };
}

function cleanOptionalId(value: unknown, field: string) {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ProfileAppearanceError(
      "INVALID_PROFILE_APPEARANCE",
      `${field} inválido.`,
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > APPEARANCE_ID_MAX_LENGTH) {
    throw new ProfileAppearanceError(
      "INVALID_PROFILE_APPEARANCE",
      `${field} inválido.`,
    );
  }
  return normalized;
}

export function parseProfileAppearanceUpdate(
  payload: unknown,
): ProfileAppearanceUpdate {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProfileAppearanceError(
      "INVALID_PROFILE_APPEARANCE",
      "Payload de aparência inválido.",
    );
  }

  const input = payload as Record<string, unknown>;
  const allowed = new Set(["titleId", "backgroundId"]);
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) {
      throw new ProfileAppearanceError(
        "UNSUPPORTED_PROFILE_APPEARANCE_FIELD",
        `Campo de aparência não suportado: ${key}.`,
      );
    }
  }
  if (Object.keys(input).length === 0) {
    throw new ProfileAppearanceError(
      "EMPTY_PROFILE_APPEARANCE_UPDATE",
      "Nenhuma alteração de aparência foi informada.",
    );
  }

  const update: { titleId?: string | null; backgroundId?: string } = {};
  if (Object.prototype.hasOwnProperty.call(input, "titleId")) {
    update.titleId = cleanOptionalId(input.titleId, "titleId");
  }
  if (Object.prototype.hasOwnProperty.call(input, "backgroundId")) {
    const backgroundId = cleanOptionalId(input.backgroundId, "backgroundId");
    if (backgroundId === null) {
      throw new ProfileAppearanceError(
        "PROFILE_BACKGROUND_REQUIRED",
        "O background de perfil não pode ser removido.",
      );
    }
    update.backgroundId = backgroundId;
  }
  return update;
}

export async function updateOwnProfileAppearance(
  userId: string,
  update: ProfileAppearanceUpdate,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const commander = await lockCommanderAppearanceState(userId, client);
    if (!commander) {
      throw new ProfileAppearanceError(
        "COMMANDER_NOT_FOUND",
        "Identidade de comandante não encontrada.",
        404,
      );
    }

    if (
      update.titleId !== undefined &&
      update.titleId !== null &&
      !(await ownsActiveCommanderTitle(userId, update.titleId, client))
    ) {
      throw new ProfileAppearanceError(
        "TITLE_NOT_OWNED_OR_INACTIVE",
        "O título informado não pertence ao comandante ou está inativo.",
        409,
      );
    }

    if (
      update.backgroundId !== undefined &&
      !(await ownsActiveProfileBackground(userId, update.backgroundId, client))
    ) {
      throw new ProfileAppearanceError(
        "BACKGROUND_NOT_OWNED_OR_INACTIVE",
        "O background informado não pertence ao comandante ou está inativo.",
        409,
      );
    }

    await updateCommanderAppearance(
      userId,
      {
        hasTitle: update.titleId !== undefined,
        titleId: update.titleId ?? null,
        backgroundId: update.backgroundId,
      },
      client,
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function getPublicProfileAppearance(
  userId: string,
): Promise<{
  title: PublicCommanderTitleAppearance | null;
  background: PublicCommanderBackgroundAppearance;
}> {
  const row = await findPublicCommanderAppearance(userId);
  if (!row) {
    throw new ProfileAppearanceError(
      "PROFILE_APPEARANCE_NOT_FOUND",
      "A aparência pública do comandante não está disponível.",
      404,
    );
  }

  const title =
    row.title_id &&
    row.title_display_text &&
    row.title_rarity &&
    row.title_font_key &&
    row.title_style_key
      ? {
          id: row.title_id,
          displayText: row.title_display_text,
          rarity: row.title_rarity,
          fontKey: row.title_font_key,
          styleKey: row.title_style_key,
          textureRef: row.title_texture_ref
            ? profileAppearanceAssetDeliveryPath(row.title_texture_ref)
            : null,
        }
      : null;

  return {
    title,
    background: {
      id: row.background_id,
      name: row.background_name,
      rarity: row.background_rarity,
      assetRef: profileAppearanceAssetDeliveryPath(row.background_asset_ref),
    },
  };
}
