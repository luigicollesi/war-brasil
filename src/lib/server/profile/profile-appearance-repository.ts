import "server-only";

import type { PoolClient } from "pg";
import type { ProfileAppearanceRarity } from "@/src/lib/profile/profile-appearance-contract";
import { pool } from "../db/pool";

export type ProfileAppearanceQueryable = Pick<PoolClient, "query">;

export type CommanderTitleAppearanceRow = {
  id: string;
  name: string;
  display_text: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  font_key: string;
  style_key: string;
  texture_ref: string | null;
  is_active: boolean;
  equipped: boolean;
};

export type CommanderBackgroundAppearanceRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rarity: ProfileAppearanceRarity;
  asset_ref: string;
  preview_ref: string | null;
  is_default: boolean;
  is_active: boolean;
  equipped: boolean;
};

export type PublicCommanderAppearanceRow = {
  title_id: string | null;
  title_display_text: string | null;
  title_rarity: ProfileAppearanceRarity | null;
  title_font_key: string | null;
  title_style_key: string | null;
  title_texture_ref: string | null;
  background_id: string;
  background_name: string;
  background_rarity: ProfileAppearanceRarity;
  background_asset_ref: string;
};

export async function findDefaultProfileBackgroundId(
  db: ProfileAppearanceQueryable = pool,
) {
  const result = await db.query<{ id: string }>(
    `SELECT id
       FROM catalog.profile_backgrounds
      WHERE is_default=TRUE
        AND is_active=TRUE
      ORDER BY id
      LIMIT 1`,
  );
  return result.rows[0]?.id ?? null;
}

export async function ensureDefaultProfileBackgroundOwnership(
  userId: string,
  db: ProfileAppearanceQueryable = pool,
) {
  const defaultId = await findDefaultProfileBackgroundId(db);
  if (!defaultId) return null;

  await db.query(
    `INSERT INTO profile.commander_backgrounds(
       user_id,background_id,acquisition_source
     )
     VALUES($1::uuid,$2,'default')
     ON CONFLICT (user_id,background_id) DO NOTHING`,
    [userId, defaultId],
  );

  return defaultId;
}

export async function listOwnedCommanderTitleAppearance(
  userId: string,
  db: ProfileAppearanceQueryable = pool,
): Promise<CommanderTitleAppearanceRow[]> {
  const result = await db.query<CommanderTitleAppearanceRow>(
    `SELECT title.id,
            title.name,
            title.display_text,
            title.description,
            title.rarity,
            title.font_key,
            title.style_key,
            title.texture_ref,
            title.is_active,
            (commander.equipped_title_id=title.id) AS equipped
       FROM profile.commander_titles owned
       JOIN catalog.commander_titles title ON title.id=owned.title_id
       JOIN profile.commanders commander ON commander.user_id=owned.user_id
      WHERE owned.user_id=$1::uuid
      ORDER BY
        (commander.equipped_title_id=title.id) DESC,
        title.is_active DESC,
        owned.unlocked_at DESC,
        lower(title.name),
        title.id`,
    [userId],
  );
  return result.rows;
}

export async function listOwnedCommanderBackgroundAppearance(
  userId: string,
  db: ProfileAppearanceQueryable = pool,
): Promise<CommanderBackgroundAppearanceRow[]> {
  const result = await db.query<CommanderBackgroundAppearanceRow>(
    `SELECT background.id,
            background.slug,
            background.name,
            background.description,
            background.rarity,
            background.asset_ref,
            background.preview_ref,
            background.is_default,
            background.is_active,
            (commander.equipped_background_id=background.id) AS equipped
       FROM profile.commander_backgrounds owned
       JOIN catalog.profile_backgrounds background
         ON background.id=owned.background_id
       JOIN profile.commanders commander ON commander.user_id=owned.user_id
      WHERE owned.user_id=$1::uuid
      ORDER BY
        (commander.equipped_background_id=background.id) DESC,
        background.is_active DESC,
        owned.unlocked_at DESC,
        lower(background.name),
        background.id`,
    [userId],
  );
  return result.rows;
}

export async function lockCommanderAppearanceState(
  userId: string,
  db: ProfileAppearanceQueryable,
) {
  const result = await db.query<{
    equipped_title_id: string | null;
    equipped_background_id: string;
  }>(
    `SELECT equipped_title_id,equipped_background_id
       FROM profile.commanders
      WHERE user_id=$1::uuid
      FOR UPDATE`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function ownsActiveCommanderTitle(
  userId: string,
  titleId: string,
  db: ProfileAppearanceQueryable,
) {
  const result = await db.query<{ id: string }>(
    `SELECT title.id
       FROM profile.commander_titles owned
       JOIN catalog.commander_titles title ON title.id=owned.title_id
      WHERE owned.user_id=$1::uuid
        AND owned.title_id=$2
        AND title.is_active=TRUE`,
    [userId, titleId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function ownsActiveProfileBackground(
  userId: string,
  backgroundId: string,
  db: ProfileAppearanceQueryable,
) {
  const result = await db.query<{ id: string }>(
    `SELECT background.id
       FROM profile.commander_backgrounds owned
       JOIN catalog.profile_backgrounds background
         ON background.id=owned.background_id
      WHERE owned.user_id=$1::uuid
        AND owned.background_id=$2
        AND background.is_active=TRUE`,
    [userId, backgroundId],
  );
  return (result.rowCount ?? 0) === 1;
}

export async function updateCommanderAppearance(
  userId: string,
  update: Readonly<{
    hasTitle: boolean;
    titleId: string | null;
    backgroundId?: string;
  }>,
  db: ProfileAppearanceQueryable,
) {
  await db.query(
    `UPDATE profile.commanders
        SET equipped_title_id=
              CASE WHEN $2::boolean THEN $3::text ELSE equipped_title_id END,
            equipped_background_id=COALESCE($4::text,equipped_background_id),
            updated_at=NOW()
      WHERE user_id=$1::uuid`,
    [
      userId,
      update.hasTitle,
      update.titleId,
      update.backgroundId ?? null,
    ],
  );
}

export async function findPublicCommanderAppearance(
  userId: string,
  db: ProfileAppearanceQueryable = pool,
): Promise<PublicCommanderAppearanceRow | null> {
  const result = await db.query<PublicCommanderAppearanceRow>(
    `SELECT title.id AS title_id,
            title.display_text AS title_display_text,
            title.rarity AS title_rarity,
            title.font_key AS title_font_key,
            title.style_key AS title_style_key,
            title.texture_ref AS title_texture_ref,
            background.id AS background_id,
            background.name AS background_name,
            background.rarity AS background_rarity,
            background.asset_ref AS background_asset_ref
       FROM profile.commanders commander
       JOIN catalog.profile_backgrounds background
         ON background.id=commander.equipped_background_id
       LEFT JOIN catalog.commander_titles title
         ON title.id=commander.equipped_title_id
      WHERE commander.user_id=$1::uuid`,
    [userId],
  );
  return result.rows[0] ?? null;
}

export async function isKnownProfileAppearanceAssetKey(
  objectKey: string,
  db: ProfileAppearanceQueryable = pool,
) {
  const result = await db.query<{ known: boolean }>(
    `SELECT EXISTS(
       SELECT 1
         FROM catalog.profile_backgrounds background
        WHERE background.asset_ref=$1
           OR background.preview_ref=$1
       UNION ALL
       SELECT 1
         FROM catalog.commander_titles title
        WHERE title.texture_ref=$1
     ) AS known`,
    [objectKey],
  );
  return Boolean(result.rows[0]?.known);
}
