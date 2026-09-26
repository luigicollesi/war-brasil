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
    applyLeetspeak(folded, LEET_CHARACTERS_PRIMARY$),
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
  const tokens = value.split(/[ ._'â€™\-]+/u).filter(Boolean);

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
    ? "Este identificador de comando nÃ£o pode ser utilizado."
    : "Este nome de comando nÃ£o pode ser utilizado.";
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
    for (const brandKey of RESERVED_COMMANDER_BRAND_KEYS"’°¢–b†6æF–FFRæ–æ6ÇVFW2†'&æD¶W’’’&V¦V7B‚“°¢Ğ¢Ğ§Ğ ¦gVæ7F–öâ76W'Dæ÷D&Æö6¶VB€¢f–VÆC¢6öÖÖæFW$–FVçF—G”f–VÆBÀ¢f&–çG3¢&WGW&åG—SÇG—VöbÖöFW&F–öåf&–çG3âÀ¢’°¢6öç7B&V¦V7BÒ‚’Óâ°¢F‡&÷ræWr6öÖÖæFW$æÖUöÆ–7”W'&÷"€¢$äÔUôäõEôÄÄõtTB"À¢f–VÆBÀ¢V&Æ–5öÆ–7”ÖW76vR†f–VÆB’À¢“°¢Ó° ¢f÷"†6öç7B6æF–FFRöbf&–çG2çv÷&Ef&–çG2’°¢–b„$Äô4´TEô4ôÔÔäDU%õtõ$E2æ†2†6æF–FFR’’&V¦V7B‚“°¢Ğ ¢f÷"†6öç7B6æF–FFRöbf&–çG2æ6ö×7Ef&–çG2’°¢–b„$Äô4´TEô4ôÔÔäDU%õtõ$E2æ†2†6æF–FFR’’&V¦V7B‚“° ¢f÷"†6öç7B6WfW&UFW&Òöb$Äô4´TEô4ôÔÔäDU%ô4ôÕ5EõDU$Õ2’°¢–b†6æF–FFRæ–æ6ÇVFW2‡6WfW&UFW&Ò’’&V¦V7B‚“°¢Ğ¢Ğ§Ğ ¦W‡÷'BgVæ7F–öâ76W'D6öÖÖæFW$†æFÆTÆÆ÷vVB‡fÇVS¢Væ¶æ÷vâ’°¢6öç7B7G'V7GW&ÂÒfÆ–FFT6öÖÖæFW$†æFÆTG&gB‡fÇVR“°¢–b‚7G'V7GW&Âæö²’°¢F‡&÷ræWr6öÖÖæFW$æÖUöÆ–7”W'&÷"€¢$”ådÄ”EôäÔUõ4„R"À¢&†æFÆR"À¢7G'V7GW&ÂæW'&÷"À¢“°¢Ğ ¢6öç7Bf&–çG2ÒÖöFW&F–öåf&–çG2‡7G'V7GW&ÂçfÇVR“°¢76W'Dæ÷E&W6W'fVB‚&†æFÆR"Âf&–çG2“°¢76W'Dæ÷D&Æö6¶VB‚&†æFÆR"Âf&–çG2“°¢&WGW&â7G'V7GW&ÂçfÇVS°§Ğ ¦W‡÷'BgVæ7F–öâ76W'D6öÖÖæFW$F—7Æ”æÖTÆÆ÷vVB‡fÇVS¢Væ¶æ÷vâ’°¢6öç7B7G'V7GW&ÂÒfÆ–FFT6öÖÖæFW$F—7Æ”æÖTG&gB‡fÇVR“°¢–b‚7G'V7GW&Âæö²’°¢F‡&÷ræWr6öÖÖæFW$æÖUöÆ–7”W'&÷"€¢$”ådÄ”EôäÔUõ4„R"À¢&F—7Æ”æÖR"À¢7G'V7GW&ÂæW'&÷"À¢“°¢Ğ ¢–b††57W7–6–÷W567&—DÖ—‚‡7G'V7GW&ÂçfÇVR’’°¢F‡&÷ræWr6öÖÖæFW$æÖUöÆ–7”W'&÷"€¢%5U5”4”õU5õTä”4ôDR"À¢&F—7Æ”æÖR"À¢V&Æ–5öÆ–7”ÖW76vR‚&F—7Æ”æÖR"’À¢“°¢Ğ ¢6öç7Bf&–çG2ÒÖöFW&F–öåf&–çG2‡7G'V7GW&ÂçfÇVR“°¢76W'Dæ÷E&W6W'fVB‚&F—7Æ”æÖR"Âf&–çG2“°¢76W'Dæ÷D&Æö6¶VB‚&F—7Æ”æÖR"Âf&–çG2“°¢&WGW&â7G'V7GW&ÂçfÇVS°§Ğ ¦W‡÷'BgVæ7F–öâ76W'D6öÖÖæFW$–FVçF—G”ÆÆ÷vVB€¢–çWC¢&VFöæÇ“Ç²†æFÆS¢Væ¶æ÷vã²F—7Æ”æÖS¢Væ¶æ÷vâÓâÀ¢“¢ÖöFW&FVD6öÖÖæFW$–FVçF—G’°¢6öç7B7G'V7GW&ÂÒfÆ–FFT6öÖÖæFW$–FVçF—G”G&gB†–çWB“°¢–b‚7G'V7GW&Âæö²’°¢6öç7Bf–VÆC¢6öÖÖæFW$–FVçF—G”f–VÆBÒ7G'V7GW&ÂæW'&÷'2æ†æFÆP¢ò&†æFÆR ¢¢&F—7Æ”æÖR#°¢F‡&÷ræWr6öÖÖæFW$æÖUöÆ–7”W'&÷"€¢$”ådÄ”EôäÔUõ4„R"À¢f–VÆBÀ¢7G'V7GW&ÂæW'&÷'5¶f–VÆEÒóò$–FVçF–FFRFR6öÖæFò–çl:Æ–Fâ"À¢“°¢Ğ ¢&WGW&â°¢†æFÆS¢76W'D6öÖÖæFW$†æFÆTÆÆ÷vVB‡7G'V7GW&ÂçfÇVRæ†æFÆR’À¢F—7Æ”æÖS¢76W'D6öÖÖæFW$F—7Æ”æÖTÆÆ÷vVB‡7G'V7GW&ÂçfÇVRæF—7Æ”æÖR’À¢Ò2ÖöFW&FVD6öÖÖæFW$–FVçF—G“°§Ğ