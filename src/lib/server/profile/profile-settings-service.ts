import "server-only";

import { pool } from "../db/pool";
import type {
  FriendRequestPolicy,
  ProfileVisibility,
} from "./profile-domain";

const DISPLAY_NAME_MAX_LENGTH = 48;
const BIO_MAX_LENGTH = 240;
const VISIBILITIES = new Set<ProfileVisibility>([
  "public",
  "friends",
  "private",
]);
const FRIEND_REQUEST_POLICIES = new Set<FriendRequestPolicy>([
  "everyone",
  "friends_of_friends",
  "nobody",
]);

export class ProfileSettingsError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ProfileSettingsError";
    this.code = code;
    this.status = status;
  }
}

export type ProfileSettingsUpdate = Readonly<{
  displayName?: string;
  bio?: string | null;
  privacy?: Readonly<{
    presenceVisibility?: ProfileVisibility;
    activityVisibility?: ProfileVisibility;
    historyVisibility?: ProfileVisibility;
    friendRequestPolicy?: FriendRequestPolicy;
  }>;
}>;

function cleanDisplayName(value: unknown) {
  if (typeof value !== "string") {
    throw new ProfileSettingsError(
      "INVALID_DISPLAY_NAME",
      "Nome público inválido.",
    );
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new ProfileSettingsError(
      "INVALID_DISPLAY_NAME",
      `Nome público deve possuir entre 1 e ${DISPLAY_NAME_MAX_LENGTH} caracteres.`,
    );
  }
  return normalized;
}

function cleanBio(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new ProfileSettingsError("INVALID_BIO", "Biografia inválida.");
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > BIO_MAX_LENGTH) {
    throw new ProfileSettingsError(
      "INVALID_BIO",
      `Biografia deve possuir no máximo ${BIO_MAX_LENGTH} caracteres.`,
    );
  }
  return normalized;
}

function cleanVisibility(value: unknown, field: string): ProfileVisibility {
  if (typeof value !== "string" || !VISIBILITIES.has(value as ProfileVisibility)) {
    throw new ProfileSettingsError(
      "INVALID_PRIVACY_SETTING",
      `Política de privacidade inválida em ${field}.`,
    );
  }
  return value as ProfileVisibility;
}

function cleanFriendRequestPolicy(value: unknown): FriendRequestPolicy {
  if (
    typeof value !== "string" ||
    !FRIEND_REQUEST_POLICIES.has(value as FriendRequestPolicy)
  ) {
    throw new ProfileSettingsError(
      "INVALID_FRIEND_REQUEST_POLICY",
      "Política de solicitações de amizade inválida.",
    );
  }
  return value as FriendRequestPolicy;
}

export function parseProfileSettingsUpdate(payload: unknown): ProfileSettingsUpdate {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new ProfileSettingsError("INVALID_PROFILE_SETTINGS", "Payload de perfil inválido.");
  }

  const input = payload as Record<string, unknown>;
  const allowedKeys = new Set(["displayName", "bio", "privacy"]);
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new ProfileSettingsError(
        "UNSUPPORTED_PROFILE_FIELD",
        `Campo de perfil não editável: ${key}.`,
      );
    }
  }

  const update: {
    displayName?: string;
    bio?: string | null;
    privacy?: {
      presenceVisibility?: ProfileVisibility;
      activityVisibility?: ProfileVisibility;
      historyVisibility?: ProfileVisibility;
      friendRequestPolicy?: FriendRequestPolicy;
    };
  } = {};

  if (Object.prototype.hasOwnProperty.call(input, "displayName")) {
    update.displayName = cleanDisplayName(input.displayName);
  }
  if (Object.prototype.hasOwnProperty.call(input, "bio")) {
    update.bio = cleanBio(input.bio);
  }

  if (Object.prototype.hasOwnProperty.call(input, "privacy")) {
    if (!input.privacy || typeof input.privacy !== "object" || Array.isArray(input.privacy)) {
      throw new ProfileSettingsError(
        "INVALID_PRIVACY_SETTING",
        "Configuração de privacidade inválida.",
      );
    }
    const privacyInput = input.privacy as Record<string, unknown>;
    const allowedPrivacyKeys = new Set([
      "presenceVisibility",
      "activityVisibility",
      "historyVisibility",
      "friendRequestPolicy",
    ]);
    for (const key of Object.keys(privacyInput)) {
      if (!allowedPrivacyKeys.has(key)) {
        throw new ProfileSettingsError(
          "UNSUPPORTED_PRIVACY_FIELD",
          `Política de privacidade não suportada: ${key}.`,
        );
      }
    }

    const privacy: NonNullable<ProfileSettingsUpdate["privacy"]> = {};
    if (Object.prototype.hasOwnProperty.call(privacyInput, "presenceVisibility")) {
      privacy.presenceVisibility = cleanVisibility(
        privacyInput.presenceVisibility,
        "presenceVisibility",
      );
    }
    if (Object.prototype.hasOwnProperty.call(privacyInput, "activityVisibility")) {
      privacy.activityVisibility = cleanVisibility(
        privacyInput.activityVisibility,
        "activityVisibility",
      );
    }
    if (Object.prototype.hasOwnProperty.call(privacyInput, "historyVisibility")) {
      privacy.historyVisibility = cleanVisibility(
        privacyInput.historyVisibility,
        "historyVisibility",
      );
    }
    if (Object.prototype.hasOwnProperty.call(privacyInput, "friendRequestPolicy")) {
      privacy.friendRequestPolicy = cleanFriendRequestPolicy(
        privacyInput.friendRequestPolicy,
      );
    }
    if (Object.keys(privacy).length > 0) update.privacy = privacy;
  }

  if (Object.keys(update).length === 0) {
    throw new ProfileSettingsError(
      "EMPTY_PROFILE_UPDATE",
      "Nenhuma alteração de perfil foi informada.",
    );
  }
  return update;
}

export async function updateOwnProfileSettings(
  userId: string,
  update: ProfileSettingsUpdate,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const commander = await client.query<{ exists: boolean }>(
      `SELECT TRUE AS exists
         FROM profile.commanders
        WHERE user_id=$1::uuid
        FOR UPDATE`,
      [userId],
    );
    if (!commander.rows[0]?.exists) {
      throw new ProfileSettingsError(
        "COMMANDER_NOT_FOUND",
        "Identidade de comandante não encontrada.",
        404,
      );
    }

    if (update.displayName !== undefined || update.bio !== undefined) {
      await client.query(
        `UPDATE profile.commanders
            SET display_name=COALESCE($2,display_name),
                bio=CASE WHEN $3::boolean THEN $4::varchar(240) ELSE bio END,
                updated_at=NOW()
          WHERE user_id=$1::uuid`,
        [
          userId,
          update.displayName ?? null,
          update.bio !== undefined,
          update.bio ?? null,
        ],
      );
    }

    if (update.privacy) {
      await client.query(
        `INSERT INTO profile.privacy_settings(
           user_id,presence_visibility,activity_visibility,
           history_visibility,friend_request_policy,updated_at
         )
         VALUES(
           $1::uuid,COALESCE($2,'friends'),COALESCE($3,'friends'),
           COALESCE($4,'friends'),COALESCE($5,'everyone'),NOW()
         )
         ON CONFLICT (user_id) DO UPDATE SET
           presence_visibility=COALESCE(EXCLUDED.presence_visibility,profile.privacy_settings.presence_visibility),
           activity_visibility=COALESCE(EXCLUDED.activity_visibility,profile.privacy_settings.activity_visibility),
           history_visibility=COALESCE(EXCLUDED.history_visibility,profile.privacy_settings.history_visibility),
           friend_request_policy=COALESCE(EXCLUDED.friend_request_policy,profile.privacy_settings.friend_request_policy),
           updated_at=NOW()`,
        [
          userId,
          update.privacy.presenceVisibility ?? null,
          update.privacy.activityVisibility ?? null,
          update.privacy.historyVisibility ?? null,
          update.privacy.friendRequestPolicy ?? null,
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
