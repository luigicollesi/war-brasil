import "server-only";

import type { AuthSession } from "./auth";
import { authPool } from "./auth-pool";
import { ensureEconomyState } from "../economy/economy-service";
import { ensureProfileAppearanceState } from "../profile/profile-appearance-service";

const HANDLE_MIN_LENGTH = 3;
const HANDLE_MAX_LENGTH = 32;
const DISPLAY_NAME_MIN_LENGTH = 2;
const DISPLAY_NAME_MAX_LENGTH = 48;
const HANDLE_PATTERN = /^[A-Za-z0-9._-]+$/;

export type CommandAccessState = {
  authenticated: true;
  profileComplete: boolean;
  profile: {
    handle: string | null;
    displayName: string | null;
  };
  suggestedDisplayName: string | null;
};

export type CommanderIdentityInput = {
  handle: string;
  displayName: string;
};

export type CommanderIdentityErrors = Partial<
  Record<keyof CommanderIdentityInput, string>
>;

export class CommanderHandleConflictError extends Error {
  constructor() {
    super("Handle de comandante indisponível.");
    this.name = "CommanderHandleConflictError";
  }
}

function cleanOptionalText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function publicDisplayNameSuggestion(session: AuthSession) {
  const candidate = cleanOptionalText(session.user.name);
  if (!candidate || candidate.toLocaleLowerCase() === "comandante") {
    return null;
  }

  return candidate.slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function validateCommanderIdentity(
  input: CommanderIdentityInput,
): CommanderIdentityErrors {
  const handle = input.handle.trim();
  const displayName = input.displayName.trim();
  const errors: CommanderIdentityErrors = {};

  if (
    handle.length < HANDLE_MIN_LENGTH ||
    handle.length > HANDLE_MAX_LENGTH ||
    !HANDLE_PATTERN.test(handle)
  ) {
    errors.handle =
      "Use 3–32 caracteres: letras, números, ponto, hífen ou sublinhado.";
  }

  if (
    displayName.length < DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > DISPLAY_NAME_MAX_LENGTH
  ) {
    errors.displayName = "Use entre 2 e 48 caracteres.";
  }

  return errors;
}

export async function getCommandAccessState(
  session: AuthSession,
): Promise<CommandAccessState> {
  const result = await authPool.query<{
    handle: string | null;
    display_name: string | null;
  }>(
    `SELECT handle, display_name
       FROM profile.commanders
      WHERE user_id = $1`,
    [session.user.id],
  );

  const row = result.rows[0];
  const handle = cleanOptionalText(row?.handle);
  const displayName = cleanOptionalText(row?.display_name);

  return {
    authenticated: true,
    profileComplete: Boolean(handle && displayName),
    profile: {
      handle,
      displayName,
    },
    suggestedDisplayName: publicDisplayNameSuggestion(session),
  };
}

export async function saveCommanderIdentity(
  session: AuthSession,
  input: CommanderIdentityInput,
) {
  const handle = input.handle.trim();
  const displayName = input.displayName.trim();
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");
    const defaultBackgroundId = await ensureProfileAppearanceState(
      session.user.id,
      client,
    );
    if (!defaultBackgroundId) {
      throw new Error("PROFILE_BACKGROUND_DEFAULT_MISSING");
    }

    const result = await client.query<{
      handle: string;
      display_name: string;
    }>(
      `INSERT INTO profile.commanders(
         user_id, handle, display_name, equipped_background_id
       )
       VALUES($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
       SET handle = EXCLUDED.handle,
           display_name = EXCLUDED.display_name,
           updated_at = NOW()
       RETURNING handle, display_name`,
      [session.user.id, handle, displayName, defaultBackgroundId],
    );

    await ensureEconomyState(session.user.id, client);
    await client.query("COMMIT");

    return {
      handle: result.rows[0].handle,
      displayName: result.rows[0].display_name,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      throw new CommanderHandleConflictError();
    }
    throw error;
  } finally {
    client.release();
  }
}
