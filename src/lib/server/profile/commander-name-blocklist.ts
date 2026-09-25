import "server-only";

export const RESERVED_COMMANDER_DISPLAY_ROLE_WORDS = new Set([
  "admin",
  "administrator",
  "administrador",
  "moderador",
  "moderator",
  "staff",
  "support",
  "suporte",
  "system",
  "sistema",
  "official",
  "oficial",
]);

export const RESERVED_COMMANDER_HANDLE_ROLE_WORDS = new Set([
  ...RESERVED_COMMANDER_DISPLAY_ROLE_WORDS,
  "adm",
  "mod",
  "developer",
  "desenvolvedor",
  "dev",
]);

export const RESERVED_COMMANDER_BRAND_KEYS = new Set([
  "bellumcivile",
]);

export const RESERVED_COMMANDER_NAME_KEYS = new Set([
  "admin",
  "administrator",
  "administrador",
  "adm",
  "moderador",
  "moderator",
  "mod",
  "staff",
  "support",
  "suporte",
  "system",
  "sistema",
  "official",
  "oficial",
  "developer",
  "desenvolvedor",
  "dev",
  "bellumcivile",
  "bellumcivileofficial",
  "bellumcivileoficial",
  "bellumcivilestaff",
]);

export const BLOCKED_COMMANDER_WORDS = new Set([
  // Portuguese
  "caralho",
  "porra",
  "merda",
  "puta",
  "puto",
  "putaria",
  "foder",
  "foda",
  "fodase",
  "buceta",
  "cuzao",
  "vagabunda",
  "vagabundo",
  // English
  "fuck",
  "fucker",
  "fucking",
  "shit",
  "bitch",
  "cunt",
  "asshole",
  "motherfucker",
  "pussy",
  // Spanish
  "mierda",
  "joder",
  "cabron",
  "pendejo",
]);

export const BLOCKED_COMMANDER_COMPACT_TERMS = new Set([
  "porn",
  "porno",
  "pornografia",
]);
