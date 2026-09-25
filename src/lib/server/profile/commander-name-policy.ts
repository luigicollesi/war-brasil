import "server-only";

import {
  validateCommanderDisplayNameDraft,
  validateCommanderIdentityDraft,
  validateCommanderHandleDraft,
  type CommanderIdentityField,
  type CommanderIdentityWriteDto,
} from "@/src/lib/profile/commander-name-contract";
import {
  BLOCKED_COMMANDER_COMPACT_TERMS,
  BLOCKED_COMMANDER_WORDS,
  RESERVED_COMMANDER_BRAND_KEYS,
  RESERVED_COMMANDER_NAME_KEYS,
  RESERVED_COMMANDER_ROLE_WORDS,
} from "./commander-name-blocklist";

export type CommanderNamePolicyCode =
  | "INVALID_NAME_SHAPE"
  | "NAME_NOT_ALLOWED"
  | "RESERVED_NAME"
  | "SUSPICIOUS_UNICODE";

export class CommanderNamePolicyError extends Error {
  readonly code: CommanderNamePolicyCode;
  readonly field: CommanderIdentityField;
  readonly publicMessage: string;

  constructor(
    code: CommanderNamePolicyCode,
    field: CommanderIdentityField,
    publicMessage: string,
  ) {
    super(publicMessage);
    this.name = "CommanderNamePolicyError";
    this.code = code;
    this.field = field;
    this.publicMessage = publicMessage;
  }
}

const DIACRITIC_MARK = /\p{M}+/gu;
const NON_ALPHANUMERIC = /[^\p{L}\p{N}]+/gu;
const REPEATED_CHARACTER = /(.)\1{2,}/gu;
const EDGE_ASCII_DIGITS = /^\d+|\d+$/g;
const LATIN_SCRIPT = /\p{Script=Latin}/u;
const CYRILLIC_SCRIPT = /\p{Script=Cyrillic}/u;
const GREEK_SCRIPT = /\p{Script=Greek}/u;

const LEET_CHARACTERS: Readonly<Record<string, string>> = Object.freeze({
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "9": "g",
});

function foldDiacritics(value: string) {
  return value.normalize("NFKD").replace(DIACRITIC_MARK, "");
}

function applyLeetspeak(value: string) {
  return [...value]
    .map((character) => LEET_CHARACTERS[character] ?? character)
    .join("");
}

function collapseEvasionRepeats(value: string) {
  return value.replace(REPEATED_CHARACTER, "$1");
}

function compact(value: string) {
  return value.replace(NON_ALPHANUMERIC, "");
}

function words(value: string) {
  return value
    .replace(NON_ALPHANUMERIC, " ")
    .trim()
    .split(/ +/)
    .filter(Boolean);
}

function stripEdgeDigits(value: string) {
  return value.replace(EDGE_ASCII_DIGITS, "");
}

function moderationVariants(value: string) {
  const folded = foldDiacritics(value.normalize("NFKC").toLocaleLowerCase("pt-BR"));
  const leet = applyLeetspeak(folded);
  const repeatedFolded = collapseEvasionRepeats(folded);
  const repeatedLeet = collapseEvasionRepeats(leet);

  const compactVariants = new Set([
    compact(folded),
    compact(leet),
    compact(repeatedFolded),
    compact(repeatedLeet),
  ]);

  for (const candidate of [...compactVariants]) {
    const edgeStripped = stripEdgeDigits(candidate);
    if (edgeStripped) compactVariants.add(edgeStripped);
  }

  const wordVariants = new Set([
    ...words(folded),
    ...words(leet),
    ...words(repeatedFolded),
    ...words(repeatedLeet),
  ]);

  return { compactVariants, wordVariants };
}

function hasSuspiciousScriptMix(value: string) {
  const tokens = value.split(/[ ._'’\-]+/u).filter(Boolean);

  return tokens.some((token) => {
    const scriptCount = [
      LATIN_SCRIPT.test(token),
      CYRILLIC_SCRIPT.test(token),
      GREEK_SCRIPT.test(token),
    ].filter(Boolean).length;

    return scriptCount > 1;
  });
}

function assertNotReserved(
  field: CommanderIdentityField,
  variants: ReturnType<typeof moderationVariants>,
) {
  const reject = () => {
    throw new CommanderNamePolicyError(
      "RESERVED_NAME",
      field,
      field === "handle"
        ? "Este identificador de comando não pode ser utilizado."
        : "Este nome de comando não pode ser utilizado.",
    );
  };

  for (const candidate of variants.wordVariants) {
    if (RESERVED_COMMANDER_ROLE_WORDS.has(candidate)) reject();
  }

  for (const candidate of variants.compactVariants) {
    if (RESERVED_COMMANDER_NAME_KEYS.has(candidate)) reject();
    for (const brandKey of RESERVED_COMMANDER_BRAND_KEYS) {
      if (candidate.includes(brandKey)) reject();
    }
  }
}

function assertNotBlocked(
  field: CommanderIdentityField,
  variants: ReturnType<typeof moderationVariants>,
) {
  for (const candidate of variants.wordVariants) {
    if (BLOCKED_COMMANDER_WORDS.has(candidate)) {
      throw new CommanderNamePolicyError(
        "NAME_NOT_ALLOWED",
        field,
        field === "handle"
          ? "Este identificador de comando não pode ser utilizado."
          : "Este nome de comando não pode ser utilizado.",
      );
    }
  }

  for (const candidate of variants.compactVariants) {
    if (BLOCKED_COMMANDER_WORDS.has(candidate)) {
      throw new CommanderNamePolicyError(
        "NAME_NOT_ALLOWED",
        field,
        field === "handle"
          ? "Este identificador de comando não pode ser utilizado."
          : "Este nome de comando não pode ser utilizado.",
      );
    }

    for (const severeTerm of BLOCKED_COMMANDER_COMPACT_TERMS) {
      if (candidate.includes(severeTerm)) {
        throw new CommanderNamePolicyError(
          "NAME_NOT_ALLOWED",
          field,
          field === "handle"
            ? "Este identificador de comando não pode ser utilizado."
            : "Este nome de comando não pode ser utilizado.",
        );
      }
    }
  }
}

export function assertCommanderHandleAllowed(value: unknown) {
  const structural = validateCommanderHandleDraft(value);
  if (!structural.ok) {
    throw new CommanderNamePolicyError(
      "INVALID_NAME_SHAPE",
      "handle",
      structural.error,
    );
  }

  const variants = moderationVariants(structural.value);
  assertNotReserved("handle", variants);
  assertNotBlocked("handle", variants);
  return structural.value;
}

export function assertCommanderDisplayNameAllowed(value: unknown) {
  const structural = validateCommanderDisplayNameDraft(value);
  if (!structural.ok) {
    throw new CommanderNamePolicyError(
      "INVALID_NAME_SHAPE",
      "displayName",
      structural.error,
    );
  }

  if (hasSuspiciousScriptMix(structural.value)) {
    throw new CommanderNamePolicyError(
      "SUSPICIOUS_UNICODE",
      "displayName",
      "Este nome de comando não pode ser utilizado.",
    );
  }

  const variants = moderationVariants(structural.value);
  assertNotReserved("displayName", variants);
  assertNotBlocked("displayName", variants);
  return structural.value;
}

export function assertCommanderIdentityAllowed(
  input: Readonly<{ handle: unknown; displayName: unknown }>,
): CommanderIdentityWriteDto {
  const structural = validateCommanderIdentityDraft(input);
  if (!structural.ok) {
    const field: CommanderIdentityField = structural.errors.handle
      ? "handle"
      : "displayName";
    throw new CommanderNamePolicyError(
      "INVALID_NAME_SHAPE",
      field,
      structural.errors[field] ?? "Identidade de comando inválida.",
    );
  }

  return {
    handle: assertCommanderHandleAllowed(structural.value.handle),
    displayName: assertCommanderDisplayNameAllowed(structural.value.displayName),
  };
}
