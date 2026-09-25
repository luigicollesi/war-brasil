import "server-only";

import type { PoolClient } from "pg";
import type { AuthSession } from "./auth";
import { authPool } from "./auth-pool";
import {
  COMMANDER_DISPLAY_NAME_MAX_LENGTH,
  type CommanderIdentityWriteDto,
} from "@/src/lib/profile/commander-name-contract";
import { assertCommanderIdentityAllowed } from "../profile/commander-name-policy";
import { ensureEconomyState } from "../economy/economy-service";
import { ensureProfileAppearanceState } from "../profile/profile-appearance-service";

export const COMMAND_MINIMUM_AGE = 10;
const MAX_REASONABLE_AGE = 120;

type CommandAccessQueryable = Pick<PoolClient, "query">;

export type CommandAccessState = {
  authenticated: true;
  ageGateComplete: boolean;
  identityComplete: boolean;
  profileComplete: boolean;
  profile: {
    handle: string | null;
    displayName: string | null;
  };
  suggestedDisplayName: string | null;
};

export type CommanderBirthDateResult =
  | Readonly<{
      eligible: true;
      accountDeleted: false;
    }>
  | Readonly<{
      eligible: false;
      accountDeleted: true;
    }>;

export class CommanderHandleConflictError extends Error {
  constructor() {
    super("Handle de comandante indisponível.");
    this.name = "CommanderHandleConflictError";
  }
}

export class CommanderAgeGateRequiredError extends Error {
  constructor() {
    super("Verificação de idade necessária.");
    this.name = "CommanderAgeGateRequiredError";
  }
}

export class CommanderIdentityLockedError extends Error {
  constructor() {
    super("A identidade pública do comandante já foi definida.");
    this.name = "CommanderIdentityLockedError";
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

  return candidate.slice(0, COMMANDER_DISPLAY_NAME_MAX_LENGTH);
}

async function ageEligibilityTableAvailable(db: CommandAccessQueryable) {
  const result = await db.query<{ available: boolean }>(
    `SELECT to_regclass('auth.user_age_eligibility') IS NOT NULL AS available`,
  );
  return result.rows[0]?.available === true;
}

async function hasAgeEligibility(
  userId: string,
  db: CommandAccessQueryable,
) {
  if (!(await ageEligibilityTableAvailable(db))) {
    // Backward-compatible deployment order: code may reach production before
    // migration 057. The age gate activates as soon as the table exists.
    return true;
  }

  const result = await db.query(
    `SELECT 1
       FROM auth.user_age_eligibility
      WHERE user_id=$1::uuid
      LIMIT 1`,
    [userId],
  );
  return Boolean(result.rowCount);
}

function parseBirthDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, iso: value };
}

function ageAtDate(
  birth: Readonly<{ year: number; month: number; day: number }>,
  now = new Date(),
) {
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  let age = currentYear - birth.year;
  if (
    currentMonth < birth.month ||
    (currentMonth === birth.month && currentDay < birth.day)
  ) {
    age -= 1;
  }
  return age;
}

export function validateCommanderBirthDate(value: string) {
  const birth = parseBirthDate(value.trim());
  if (!birth) {
    return "Informe uma data de nascimento válida.";
  }

  const age = ageAtDate(birth);
  if (age < 0) {
    return "A data de nascimento não pode estar no futuro.";
  }
  if (age > MAX_REASONABLE_AGE) {
    return "Revise a data de nascimento informada.";
  }

  return null;
}

export async function getCommandAccessState(
  session: AuthSession,
): Promise<CommandAccessState> {
  const [profileResult, ageGateComplete] = await Promise.all([
    authPool.query<{
      handle: string | null;
      display_name: string | null;
    }>(
      `SELECT handle, display_name
         FROM profile.commanders
        WHERE user_id = $1`,
      [session.user.id],
    ),
    hasAgeEligibility(session.user.id, authPool),
  ]);

  const row = profileResult.rows[0];
  const handle = cleanOptionalText(row?.handle);
  const displayName = cleanOptionalText(row?.display_name);
  const identityComplete = Boolean(handle && displayName);

  return {
    authenticated: true,
    ageGateComplete,
    identityComplete,
    profileComplete: ageGateComplete && identityComplete,
    profile: {
      handle,
      displayName,
    },
    suggestedDisplayName: publicDisplayNameSuggestion(session),
  };
}

export async function saveCommanderBirthDate(
  session: AuthSession,
  birthDateValue: string,
): Promise<CommanderBirthDateResult> {
  const birth = parseBirthDate(birthDateValue.trim());
  if (!birth || validateCommanderBirthDate(birth.iso)) {
    throw new Error("INVALID_BIRTH_DATE");
  }

  const age = ageAtDate(birth);
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");

    const account = await client.query(
      `SELECT id
         FROM auth."user"
        WHERE id=$1::uuid
        FOR UPDATE`,
      [session.user.id],
    );

    if (!account.rowCount) {
      throw new Error("AUTH_USER_MISSING");
    }

    if (age < COMMAND_MINIMUM_AGE) {
      await client.query(
        `DELETE FROM auth."user"
          WHERE id=$1::uuid`,
        [session.user.id],
      );
      await client.query("COMMIT");
      return { eligible: false, accountDeleted: true };
    }

    if (!(await ageEligibilityTableAvailable(client))) {
      throw new Error("AGE_GATE_SCHEMA_MISSING");
    }

    await client.query(
      `INSERT INTO auth.user_age_eligibility(
         user_id,
         birth_date,
         minimum_age_at_verification,
         verification_method,
         verified_at
       )
       VALUES($1::uuid,$2::date,$3,'self_declared',NOW())
       ON CONFLICT (user_id) DO NOTHING`,
      [session.user.id, birth.iso, COMMAND_MINIMUM_AGE],
    );

    await client.query("COMMIT");
    return { eligible: true, accountDeleted: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function saveCommanderIdentity(
  session: AuthSession,
  input: CommanderIdentityWriteDto,
) {
  const identity = assertCommanderIdentityAllowed(input);
  const handle = identity.handle;
  const displayName = identity.displayName;
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");

    if (!(await hasAgeEligibility(session.user.id, client))) {
      throw new CommanderAgeGateRequiredError();
    }

    const defaultBackgroundId = await ensureProfileAppearanceState(
      session.user.id,
      client,
    );
    if (!defaultBackgroundId) {
      throw new Error("PROFILE_BACKGROUND_DEFAULT_MISSING");
    }

    const existing = await client.query<{
      handle: string | null;
      display_name: string | null;
    }>(
      `SELECT handle, display_name
         FROM profile.commanders
        WHERE user_id=$1::uuid
        FOR UPDATE`,
      [session.user.id],
    );
    const current = existing.rows[0] ?? null;

    if (current?.handle && current.handle !== handle) {
      throw new CommanderIdentityLockedError();
    }

    if (current?.handle && current.display_name) {
      if (current.display_name !== displayName) {
        throw new CommanderIdentityLockedError();
      }

      await ensureEconomyState(session.user.id, client);
      await client.query("COMMIT");
      return {
        handle: current.handle,
        displayName: current.display_name,
      };
    }

    const result = current
      ? await client.query<{
          handle: string;
          display_name: string;
        }>(
          `UPDATE profile.commanders
              SET handle=COALESCE(handle,$2),
                  display_name=COALESCE(display_name,$3),
                  updated_at=NOW()
            WHERE user_id=$1::uuid
            RETURNING handle, display_name`,
          [session.user.id, handle, displayName],
        )
      : await client.query<{
          handle: string;
          display_name: string;
        }>(
          `INSERT INTO profile.commanders(user_id, handle, display_name)
           VALUES($1, $2, $3)
           RETURNING handle, display_name`,
          [session.user.id, handle, displayName],
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
