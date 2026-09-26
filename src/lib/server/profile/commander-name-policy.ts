import "server-only";

import {
  validateCommanderDisplayNameDraft,
  validateCommanderIdentityDraft,
  validateCommanderHandleDraft,
  type CommanderIdentityField,
  type CommanderIdentityWriteDto,
} from "../../profile/commander-name-contract";
import {
  BLOCKED_COMMANDER_COMPACT_TERMS,
  BLOCKED_COMMANDER_WORDS,
  RESERVED_COMMANDER_BRAND_KEYS,
  RESERVED_COMMANDER_DISPLAY_ROLE_WORDS,
  RESERVED_COMMANDER_HANDLE_ROLE_WORDS,
  RESERVED_COMMANDER_NAME_KEYS,
} from "./commander-name-blocklist";

export type CommanderNamePolicyCode =
  | "INVALID_NAME_SHAPE"
  | "NAME_NOT_ALLOWED"
  | "RESERVED_NAME"
  | "SUSPICIOUS_UNICODE";

declare const MODERATED_COMMANDER_IDENTITY: unique symbol;

export type ModeratedCommanderIdentity = CommanderIdentityWriteDto &
  Readonly<{
    [MODERATED_COMMANDER_IDENTITY]: true;
  }>;

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
const REPEATED_CHARACTER = /(.)\1+/gu;
const EDGE_ASCII_DIGITS = /^\d+|\d+$/g;
const LATIN_SCRIPT = /\p{Script=Latin}/u;
const CYRILLIC_SCRIPT = /\p{Script=Cyrillic}/u;
const GREEK_SCRIPT = /\p{Script=Greek}/u;

const LEET_CHARACTERS_PRIMARY: Readonly<Record<string, string>> = Object.freeze({
  "0": "o",
  "1": "i",
  "2": "z",
  "3": "e",
  "4": "a",
  "5": "s",
  "6": "g",
  "7": "t",
  "8": "b",
  "9": "g",
});

const LEET_CHARACTERS_ALTERNATE: Readonly<Record<string, string>> = Object.freeze({
  ...LEET_CHARACTERS_PRIMARY,
  "1": "l",
});

function foldDiacritics(value: string) {
  return value.normalize("NFKD").replace(DIACRITIC_MARK, "");
}

function applyLeetspeak(
  value: string,
  replacements: Readonly<Record<string, string>>,
) {
  return [...value]
    .map((character) => replacements[character] ?? character)
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
  const leetVariants = new Set([
    applyLeetspeak(folded, LEET_CHARACTERS_PRIMARY),
    applyLeetspeak(folded, LEET_CHARACTERS_ALTERNATE),
  ]);
  const baseVariants = new Set([folded, ...leetVariants]);

  for (const candidate of [...baseVariants]) {
    baseVariants.add(collapseEvasionRepeats(candidate));
  }

  const compactVariants = new Set(
    [...baseVariants].map((candidate) => compact(candidate)).filter(Boolean),
  );

  for (const candidate of [...compactVariants]) {
    const edgeStripped = stripEdgeDigits(candidate);
    if (edgeStripped) compactVariants.add(edgeStripped);
  }

  const wordVariants = new Set(
    [...baseVariants].flatMap((candidate) => words(candidate)),
  );

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

function publicPolicyMessage(field: CommanderIdentityField) {
  return field === "handle"
    ? "Este identificador de comando não pode ser utilizado."
    : "Este nome de comando não pode ser utilizado.";
}

function assertNotReserved(
  field: CommanderIdentityField,
  variants: ReturnType<typeof moderationVariants>,
) {
  const reject = () => {
    throw new CommanderNamePolicyError(
      "RESERVED_NAME",
      field,
      publicPolicyMessage(field),
    );
  };

  const reservedRoleWords =
    field === "handle"
      ? RESERVED_COMMANDER_HANDLE_ROLE_WORDS
      : RESERVED_COMMANDER_DISPLAY_ROLE_WORDS;

  for (const candidate of variants.wordVariants) {
    if (reservedRoleWords.has(candidate)) reject();
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
  const reject = () => {
    throw new CommanderNamePolicyError(
      "NAME_NOT_ALLOWED",
      field,
      publicPolicyMessage(field),
    );
  };

  for (const candidate of variants.wordVariants) {
    if (BLOCKED_COMMANDER_WORDS.has(candidate)) reject();
  }

  for (const candidate of variants.compactVariants) {
    if (BLOCKED_COMMANDER_WORDS.has(candidate)) reject();

    for (const severeTerm of BLOCKED_COMMANDER_COMPACT_TERMS) {
      if (candidate.includes(severeTerm)) reject();
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
      publicPolicyMessage("displayName"),
    );
  }

  const variants = moderationVariants(structural.value);
  assertNotReserved("displayName", variants);
  assertNotBlocked("displayName", variants);
  return structural.value;
}

export function assertCommanderIdentityAllowed(
  input: Readonly<{ handle: unknown; displayName: unknown }>,
): ModeratedCommanderIdentity {
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
  } as ModeratedCommanderIdentity;
}
