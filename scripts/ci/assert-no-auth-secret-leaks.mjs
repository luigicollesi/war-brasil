import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SENTINELS = [
  ["BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET],
  ["GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET],
  ["APPLE_PRIVATE_KEY", process.env.APPLE_PRIVATE_KEY],
  ["DISCORD_CLIENT_SECRET", process.env.DISCORD_CLIENT_SECRET],
  ["EMAIL_TRANSPORT_SECRET", process.env.EMAIL_TRANSPORT_SECRET],
].filter(([, value]) => typeof value === "string" && value.length > 0);

if (SENTINELS.length !== 5) {
  throw new Error(
    "Leak scan exige os cinco sentinels falsos de autenticação no ambiente de CI.",
  );
}

const PUBLIC_STATIC_ROOT = path.resolve(".next/static");
const SERIALIZED_ROOTS = [
  path.resolve(".next/server/app"),
  path.resolve(".next/server/pages"),
];
const SERIALIZED_EXTENSIONS = new Set([
  ".html",
  ".rsc",
  ".txt",
  ".json",
  ".map",
  ".body",
]);

function walk(root, include) {
  if (!existsSync(root)) return [];

  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(absolute, include));
    } else if (entry.isFile() && include(absolute)) {
      files.push(absolute);
    }
  }
  return files;
}

const candidates = [
  ...walk(PUBLIC_STATIC_ROOT, () => true),
  ...SERIALIZED_ROOTS.flatMap((root) =>
    walk(root, (file) => SERIALIZED_EXTENSIONS.has(path.extname(file))),
  ),
];

if (candidates.length === 0) {
  throw new Error("Leak scan não encontrou artefatos públicos do build para inspecionar.");
}

const leaks = [];
for (const file of candidates) {
  if (statSync(file).size === 0) continue;

  const content = readFileSync(file);
  for (const [label, value] of SENTINELS) {
    if (content.includes(Buffer.from(value))) {
      leaks.push({ label, file: path.relative(process.cwd(), file) });
    }
  }
}

if (leaks.length > 0) {
  const summary = leaks
    .map(({ label, file }) => `${label} encontrado em ${file}`)
    .join("; ");
  throw new Error(`Secret leak detectado: ${summary}`);
}

console.log(
  `[auth-leak-scan] ${candidates.length} artefatos públicos verificados; nenhum sentinel encontrado.`,
);
