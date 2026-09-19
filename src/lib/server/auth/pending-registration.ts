import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { authPool } from "./auth-pool";
import { readAuthServerEnvironment } from "./environment";

const OTP_LENGTH = 6;
export const REGISTRATION_CODE_TTL_SECONDS = 10 * 60;
export const REGISTRATION_RESEND_COOLDOWN_SECONDS = 60;
export const REGISTRATION_MAX_ATTEMPTS = 5;
const PENDING_REGISTRATION_RETENTION_HOURS = 24;

type PendingRegistrationRow = {
  password_ciphertext: string;
  verification_code_hash: string;
  attempts: number;
  code_expires_at: Date;
};

export type BeginPendingRegistrationResult = {
  code: string | null;
  dispatched: boolean;
  retryAfterSeconds: number;
};

export type VerifyPendingRegistrationResult =
  | {
      status: "created";
      email: string;
      password: string;
    }
  | {
      status:
        | "missing"
        | "expired"
        | "invalid"
        | "too_many_attempts"
        | "account_exists";
    };

export function normalizeRegistrationEmail(value: string) {
  return value.trim().toLowerCase();
}

function registrationSecret() {
  const secret = readAuthServerEnvironment().secret;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET é obrigatório para cadastro por email.");
  }
  return secret;
}

function passwordEncryptionKey() {
  return createHash("sha256")
    .update("war-brasil:pending-registration:password:v1\0")
    .update(registrationSecret())
    .digest();
}

function encryptPendingPassword(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", passwordEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptPendingPassword(payload: string) {
  const [version, ivValue, tagValue, ciphertextValue] = payload.split(".");
  if (
    version !== "v1" ||
    !ivValue ||
    !tagValue ||
    ciphertextValue === undefined
  ) {
    throw new Error("Credencial temporária inválida.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    passwordEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function generateRegistrationCode() {
  return randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

function registrationCodeHash(email: string, code: string) {
  return createHmac("sha256", registrationSecret())
    .update("war-brasil:pending-registration:otp:v1\0")
    .update(email)
    .update("\0")
    .update(code)
    .digest("hex");
}

function codeHashMatches(storedHash: string, email: string, code: string) {
  const candidate = registrationCodeHash(email, code);
  const stored = Buffer.from(storedHash, "hex");
  const received = Buffer.from(candidate, "hex");
  return stored.length === received.length && timingSafeEqual(stored, received);
}

async function removeStaleRegistrations() {
  await authPool.query(
    `DELETE FROM auth.pending_registration
      WHERE created_at < NOW() - ($1::text || ' hours')::interval`,
    [PENDING_REGISTRATION_RETENTION_HOURS],
  );
}

export async function beginPendingRegistration(input: {
  email: string;
  password: string;
}): Promise<BeginPendingRegistrationResult> {
  const email = normalizeRegistrationEmail(input.email);
  const code = generateRegistrationCode();
  const codeHash = registrationCodeHash(email, code);
  const passwordCiphertext = encryptPendingPassword(input.password);
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM auth.pending_registration
        WHERE created_at < NOW() - ($1::text || ' hours')::interval`,
      [PENDING_REGISTRATION_RETENTION_HOURS],
    );

    const existingAccount = await client.query<{ email_verified: boolean }>(
      `SELECT "emailVerified" AS email_verified
         FROM auth."user"
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email],
    );

    if (existingAccount.rowCount && existingAccount.rows[0]?.email_verified) {
      await client.query("COMMIT");
      return {
        code: null,
        dispatched: false,
        retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
      };
    }

    const pending = await client.query<{ retry_after_seconds: number }>(
      `SELECT GREATEST(
          0,
          CEIL(EXTRACT(EPOCH FROM (resend_available_at - NOW())))
        )::int AS retry_after_seconds
         FROM auth.pending_registration
        WHERE email = $1
        FOR UPDATE`,
      [email],
    );

    const retryAfterSeconds = pending.rows[0]?.retry_after_seconds ?? 0;
    if (retryAfterSeconds > 0) {
      await client.query("COMMIT");
      return {
        code: null,
        dispatched: false,
        retryAfterSeconds,
      };
    }

    await client.query(
      `INSERT INTO auth.pending_registration (
         email,
         password_ciphertext,
         verification_code_hash,
         attempts,
         terms_accepted_at,
         code_expires_at,
         resend_available_at,
         created_at,
         updated_at
       )
       VALUES(
         $1,
         $2,
         $3,
         0,
         NOW(),
         NOW() + ($4::text || ' seconds')::interval,
         NOW() + ($5::text || ' seconds')::interval,
         NOW(),
         NOW()
       )
       ON CONFLICT (email) DO UPDATE
       SET password_ciphertext = EXCLUDED.password_ciphertext,
           verification_code_hash = EXCLUDED.verification_code_hash,
           attempts = 0,
           terms_accepted_at = NOW(),
           code_expires_at = EXCLUDED.code_expires_at,
           resend_available_at = EXCLUDED.resend_available_at,
           updated_at = NOW()`,
      [
        email,
        passwordCiphertext,
        codeHash,
        REGISTRATION_CODE_TTL_SECONDS,
        REGISTRATION_RESEND_COOLDOWN_SECONDS,
      ],
    );

    await client.query("COMMIT");
    return {
      code,
      dispatched: true,
      retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function resendPendingRegistration(
  emailInput: string,
): Promise<BeginPendingRegistrationResult> {
  const email = normalizeRegistrationEmail(emailInput);
  const code = generateRegistrationCode();
  const codeHash = registrationCodeHash(email, code);
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");

    const existingAccount = await client.query(
      `SELECT 1
         FROM auth."user"
        WHERE lower(email) = lower($1)
          AND "emailVerified" = TRUE
        LIMIT 1`,
      [email],
    );

    if (existingAccount.rowCount) {
      await client.query("COMMIT");
      return {
        code: null,
        dispatched: false,
        retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
      };
    }

    const pending = await client.query<{ retry_after_seconds: number }>(
      `SELECT GREATEST(
          0,
          CEIL(EXTRACT(EPOCH FROM (resend_available_at - NOW())))
        )::int AS retry_after_seconds
         FROM auth.pending_registration
        WHERE email = $1
        FOR UPDATE`,
      [email],
    );

    if (!pending.rowCount) {
      await client.query("COMMIT");
      return {
        code: null,
        dispatched: false,
        retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
      };
    }

    const retryAfterSeconds = pending.rows[0]?.retry_after_seconds ?? 0;
    if (retryAfterSeconds > 0) {
      await client.query("COMMIT");
      return {
        code: null,
        dispatched: false,
        retryAfterSeconds,
      };
    }

    await client.query(
      `UPDATE auth.pending_registration
          SET verification_code_hash = $2,
              attempts = 0,
              code_expires_at = NOW() + ($3::text || ' seconds')::interval,
              resend_available_at = NOW() + ($4::text || ' seconds')::interval,
              updated_at = NOW()
        WHERE email = $1`,
      [
        email,
        codeHash,
        REGISTRATION_CODE_TTL_SECONDS,
        REGISTRATION_RESEND_COOLDOWN_SECONDS,
      ],
    );

    await client.query("COMMIT");
    return {
      code,
      dispatched: true,
      retryAfterSeconds: REGISTRATION_RESEND_COOLDOWN_SECONDS,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyPendingRegistration(
  emailInput: string,
  code: string,
): Promise<VerifyPendingRegistrationResult> {
  const email = normalizeRegistrationEmail(emailInput);
  const client = await authPool.connect();

  try {
    await client.query("BEGIN");

    const pending = await client.query<PendingRegistrationRow>(
      `SELECT
         password_ciphertext,
         verification_code_hash,
         attempts,
         code_expires_at
       FROM auth.pending_registration
       WHERE email = $1
       FOR UPDATE`,
      [email],
    );

    const row = pending.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return { status: "missing" };
    }

    if (row.attempts >= REGISTRATION_MAX_ATTEMPTS) {
      await client.query("COMMIT");
      return { status: "too_many_attempts" };
    }

    if (row.code_expires_at.getTime() <= Date.now()) {
      await client.query("COMMIT");
      return { status: "expired" };
    }

    if (!codeHashMatches(row.verification_code_hash, email, code)) {
      const attempts = Math.min(
        REGISTRATION_MAX_ATTEMPTS,
        row.attempts + 1,
      );
      await client.query(
        `UPDATE auth.pending_registration
            SET attempts = $2,
                updated_at = NOW()
          WHERE email = $1`,
        [email, attempts],
      );
      await client.query("COMMIT");
      return {
        status:
          attempts >= REGISTRATION_MAX_ATTEMPTS
            ? "too_many_attempts"
            : "invalid",
      };
    }

    const existingAccount = await client.query<{ email_verified: boolean }>(
      `SELECT "emailVerified" AS email_verified
         FROM auth."user"
        WHERE lower(email) = lower($1)
        LIMIT 1`,
      [email],
    );

    if (existingAccount.rowCount) {
      await client.query(
        "DELETE FROM auth.pending_registration WHERE email = $1",
        [email],
      );
      await client.query("COMMIT");
      return { status: "account_exists" };
    }

    const password = decryptPendingPassword(row.password_ciphertext);
    const passwordHash = await hashPassword(password);
    const userId = randomUUID();

    await client.query(
      `INSERT INTO auth."user" (
         id,
         name,
         email,
         "emailVerified",
         image,
         "createdAt",
         "updatedAt"
       )
       VALUES($1, 'Comandante', $2, TRUE, NULL, NOW(), NOW())`,
      [userId, email],
    );

    await client.query(
      `INSERT INTO auth."account" (
         id,
         "accountId",
         "providerId",
         "userId",
         password,
         "createdAt",
         "updatedAt"
       )
       VALUES($1, $2, 'credential', $2, $3, NOW(), NOW())`,
      [randomUUID(), userId, passwordHash],
    );

    await client.query(
      "DELETE FROM auth.pending_registration WHERE email = $1",
      [email],
    );

    await client.query("COMMIT");
    return {
      status: "created",
      email,
      password,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function cleanupPendingRegistrations() {
  await removeStaleRegistrations();
}
