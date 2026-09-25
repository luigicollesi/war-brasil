export const COMMANDER_HANDLE_MIN_LENGTH = 3;
export const COMMANDER_HANDLE_MAX_LENGTH = 32;
export const COMMANDER_DISPLAY_NAME_MIN_LENGTH = 2;
export const COMMANDER_DISPLAY_NAME_MAX_LENGTH = 48;

const HANDLE_CHARACTERS = /^[A-Za-z0-9._-]+$/;
const HANDLE_EDGE = /^[A-Za-z0-9].*[A-Za-z0-9]$/;
const REPEATED_HANDLE_SEPARATOR = /[._-]{2}/;
const CONTROL_OR_FORMAT_CHARACTER = /[\p{Cc}\p{Cf}]/u;
const DISPLAY_NAME_CHARACTERS = /^[\p{L}\p{M}\p{N} ._'’\-]+$/u;

export type CommanderIdentityWriteDto = Readonly<{
  handle: string;
  displayName: string;
}>;

export type CommanderIdentityField = keyof CommanderIdentityWriteDto;
export type CommanderIdentityErrors = Partial<
  Record<CommanderIdentityField, string>
>;

export type CommanderIdentityValidationResult =
  | Readonly<{
      ok: true;
      value: CommanderIdentityWriteDto;
      errors: Readonly<Record<string, never>>;
    }>
  | Readonly<{
      ok: false;
      value: null;
      errors: CommanderIdentityErrors;
    }>;

export type CommanderTextValidationResult =
  | Readonly<{ ok: true; value: string; error: null }>
  | Readonly<{ ok: false; value: null; error: string }>;

function normalizeDisplayWhitespace(value: string) {
  return value.trim().replace(/ +/g, " ");
}

export function validateCommanderHandleDraft(
  value: unknown,
): CommanderTextValidationResult {
  if (typeof value !== "string") {
    return { ok: false, value: null, error: "Identificador de comando inválido." };
  }

  const handle = value.trim();
  if (
    handle.length < COMMANDER_HANDLE_MIN_LENGTH ||
    handle.length > COMMANDER_HANDLE_MAX_LENGTH
  ) {
    return {
      ok: false,
      value: null,
      error: `Use ${COMMANDER_HANDLE_MIN_LENGTH}–${COMMANDER_HANDLE_MAX_LENGTH} caracteres.`,
    };
  }

  if (!HANDLE_CHARACTERS.test(handle)) {
    return {
      ok: false,
      value: null,
      error: "Use apenas letras, números, ponto, hífen ou sublinhado.",
    };
  }

  if (!HANDLE_EDGE.test(handle)) {
    return {
      ok: false,
      value: null,
      error: "Comece e termine o identificador com uma letra ou número.",
    };
  }

  if (REPEATED_HANDLE_SEPARATOR.test(handle)) {
    return {
      ok: false,
      value: null,
      error: "Não use separadores consecutivos no identificador.",
    };
  }

  return { ok: true, value: handle, error: null };
}

export function validateCommanderDisplayNameDraft(
  value: unknown,
): CommanderTextValidationResult {
  if (typeof value !== "string") {
    return { ok: false, value: null, error: "Nome de comando inválido." };
  }

  if (CONTROL_OR_FORMAT_CHARACTER.test(value)) {
    return {
      ok: false,
      value: null,
      error: "O nome contém caracteres invisíveis ou de controle.",
    };
  }

  const displayName = normalizeDisplayWhitespace(value.normalize("NFKC"));

  if (
    displayName.length < COMMANDER_DISPLAY_NAME_MIN_LENGTH ||
    displayName.length > COMMANDER_DISPLAY_NAME_MAX_LENGTH
  ) {
    return {
      ok: false,
      value: null,
      error: `Use entre ${COMMANDER_DISPLAY_NAME_MIN_LENGTH} e ${COMMANDER_DISPLAY_NAME_MAX_LENGTH} caracteres.`,
    };
  }

  if (!DISPLAY_NAME_CHARACTERS.test(displayName)) {
    return {
      ok: false,
      value: null,
      error:
        "Use apenas letras, números, espaços e os símbolos ponto, apóstrofo, hífen ou sublinhado.",
    };
  }

  return { ok: true, value: displayName, error: null };
}

export function validateCommanderIdentityDraft(
  input: Readonly<{ handle: unknown; displayName: unknown }>,
): CommanderIdentityValidationResult {
  const handle = validateCommanderHandleDraft(input.handle);
  const displayName = validateCommanderDisplayNameDraft(input.displayName);
  const errors: CommanderIdentityErrors = {};

  if (!handle.ok) errors.handle = handle.error;
  if (!displayName.ok) errors.displayName = displayName.error;

  if (!handle.ok || !displayName.ok) {
    return { ok: false, value: null, errors };
  }

  return {
    ok: true,
    value: {
      handle: handle.value,
      displayName: displayName.value,
    },
    errors: {},
  };
}

export function parseCommanderIdentityWriteDto(
  payload: unknown,
): CommanderIdentityValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {
      ok: false,
      value: null,
      errors: {
        handle: "Identificador de comando inválido.",
        displayName: "Nome de comando inválido.",
      },
    };
  }

  const input = payload as Record<string, unknown>;
  const allowedKeys = new Set(["handle", "displayName"]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    return {
      ok: false,
      value: null,
      errors: {
        displayName: "A identidade enviada contém campos não suportados.",
      },
    };
  }

  return validateCommanderIdentityDraft({
    handle: input.handle,
    displayName: input.displayName,
  });
}
