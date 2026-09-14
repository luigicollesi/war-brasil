import "server-only";

import { pool } from "../db/pool";

const TITLE_ID_MAX_LENGTH = 128;

export type CommanderOwnedTitle = Readonly<{
  id: string;
  name: string;
  description: string | null;
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  isActive: boolean;
  equipped: boolean;
}>;

type CommanderOwnedTitleRow = {
  id: string;
  name: string;
  description: string | null;
  rarity: CommanderOwnedTitle["rarity"];
  is_active: boolean;
  equipped: boolean;
};

export class ProfileTitleError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ProfileTitleError";
    this.code = code;
    this.status = status;
  }
}

export function parseCommanderTitleSelection(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProfileTitleError("INVALID_TITLE_SELECTION", "Seleção de título inválida.");
  }

  const input = payload as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "titleId") {
    throw new ProfileTitleError(
      "INVALID_TITLE_SELECTION",
      "A seleção deve informar somente titleId.",
    );
  }

  if (input.titleId === null) return null;
  if (typeof input.titleId !== "string") {
    throw new ProfileTitleError("INVALID_TITLE_ID", "Título inválido.");
  }

  const titleId = input.titleId.trim();
  if (!titleId || titleId.length > TITLE_ID_MAX_LENGTH) {
    throw new ProfileTitleError("INVALID_TITLE_ID", "Título inválido.");
  }
  return titleId;
}

export async function listOwnedCommanderTitles(
  userId: string,
): Promise<CommanderOwnedTitle[]> {
  const result = await pool.query<CommanderOwnedTitleRow>(
    `SELECT
       title.id,
       title.name,
       title.description,
       title.rarity,
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

  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    rarity: row.rarity,
    isActive: row.is_active,
    equipped: row.equipped,
  }));
}

export async function equipOwnedCommanderTitle(
  userId: string,
  titleId: string | null,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const commander = await client.query<{ equipped_title_id: string | null }>(
      `SELECT equipped_title_id
         FROM profile.commanders
        WHERE user_id=$1::uuid
        FOR UPDATE`,
      [userId],
    );
    if (commander.rowCount !== 1) {
      throw new ProfileTitleError(
        "COMMANDER_NOT_FOUND",
        "Identidade de comandante não encontrada.",
        404,
      );
    }

    if (titleId !== null) {
      const owned = await client.query<{ id: string }>(
        `SELECT title.id
           FROM profile.commander_titles owned
           JOIN catalog.commander_titles title ON title.id=owned.title_id
          WHERE owned.user_id=$1::uuid
            AND owned.title_id=$2
            AND title.is_active=TRUE`,
        [userId, titleId],
      );
      if (owned.rowCount !== 1) {
        throw new ProfileTitleError(
          "TITLE_NOT_OWNED_OR_INACTIVE",
          "O título informado não está disponível para este comandante.",
          409,
        );
      }
    }

    await client.query(
      `UPDATE profile.commanders
          SET equipped_title_id=$2,
              updated_at=NOW()
        WHERE user_id=$1::uuid`,
      [userId, titleId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
