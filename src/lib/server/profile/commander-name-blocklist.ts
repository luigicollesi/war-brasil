import "server-only";

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
