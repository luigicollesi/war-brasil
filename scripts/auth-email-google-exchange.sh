#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_REDIRECT_URI="http://localhost:3000/api/google/callback"
STATE_FILE="${TMPDIR:-/tmp}/war-brasil-google-mailer-oauth-${UID:-user}.state"

usage() {
  echo "Uso: bash scripts/auth-email-google-exchange.sh 'http://localhost:3000/api/google/callback?code=...&state=...'" >&2
}

if [[ $# -gt 1 ]]; then
  usage
  exit 2
fi

if [[ $# -eq 1 ]]; then
  CALLBACK_URL="$1"
else
  printf "Cole a URL completa retornada pelo Google e pressione Enter:\n> "
  IFS= read -r CALLBACK_URL
fi

if [[ -z "$CALLBACK_URL" ]]; then
  echo "Erro: nenhuma URL de callback foi informada." >&2
  exit 2
fi

read_env_value() {
  local key="$1"
  ROOT_DIR="$ROOT_DIR" ENV_KEY="$key" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

const root = process.env.ROOT_DIR;
const key = process.env.ENV_KEY;
if (process.env[key]) {
  process.stdout.write(process.env[key]);
  process.exit(0);
}

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return new Map();
  const result = new Map();

  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    result.set(match[1], value);
  }

  return result;
}

for (const name of [".env.local", ".env"]) {
  const values = parseEnvFile(path.join(root, name));
  if (values.has(key)) {
    process.stdout.write(values.get(key));
    process.exit(0);
  }
}
NODE
}

CLIENT_ID="$(read_env_value AUTH_EMAIL_GOOGLE_CLIENT_ID)"
CLIENT_SECRET="$(read_env_value AUTH_EMAIL_GOOGLE_CLIENT_SECRET)"
REDIRECT_URI="$(read_env_value AUTH_EMAIL_GOOGLE_REDIRECT_URI)"
FROM_ADDRESS="$(read_env_value AUTH_EMAIL_FROM)"

if [[ -z "$REDIRECT_URI" ]]; then
  REDIRECT_URI="$DEFAULT_REDIRECT_URI"
fi

if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "Erro: configure AUTH_EMAIL_GOOGLE_CLIENT_ID e AUTH_EMAIL_GOOGLE_CLIENT_SECRET antes da troca." >&2
  exit 1
fi

mapfile -t CALLBACK_PARTS < <(
  node - "$CALLBACK_URL" <<'NODE'
let url;
try {
  url = new URL(process.argv[2]);
} catch {
  console.error("URL de callback inválida.");
  process.exit(1);
}

const error = url.searchParams.get("error") ?? "";
const code = url.searchParams.get("code") ?? "";
const state = url.searchParams.get("state") ?? "";
const callbackBase = `${url.origin}${url.pathname}`;

process.stdout.write([error, code, state, callbackBase].join("\n"));
NODE
)

OAUTH_ERROR="${CALLBACK_PARTS[0]:-}"
AUTH_CODE="${CALLBACK_PARTS[1]:-}"
RETURNED_STATE="${CALLBACK_PARTS[2]:-}"
CALLBACK_BASE="${CALLBACK_PARTS[3]:-}"

if [[ -n "$OAUTH_ERROR" ]]; then
  echo "Google retornou erro OAuth: $OAUTH_ERROR" >&2
  exit 1
fi

if [[ -z "$AUTH_CODE" ]]; then
  echo "Erro: a URL não contém o parâmetro code." >&2
  exit 1
fi

if [[ "$CALLBACK_BASE" != "$REDIRECT_URI" ]]; then
  echo "Erro: callback recebido não corresponde ao redirect URI usado na autorização." >&2
  echo "Esperado: $REDIRECT_URI" >&2
  echo "Recebido: $CALLBACK_BASE" >&2
  exit 1
fi

if [[ ! -f "$STATE_FILE" ]]; then
  echo "Erro: estado OAuth local não encontrado. Rode primeiro auth-email-google-authorize.sh." >&2
  exit 1
fi

EXPECTED_STATE="$(sed -n '1p' "$STATE_FILE")"
EXPECTED_REDIRECT="$(sed -n '2p' "$STATE_FILE")"

if [[ -z "$RETURNED_STATE" || "$RETURNED_STATE" != "$EXPECTED_STATE" ]]; then
  echo "Erro: state OAuth inválido. Não vou trocar esse código." >&2
  exit 1
fi

if [[ "$EXPECTED_REDIRECT" != "$REDIRECT_URI" ]]; then
  echo "Erro: o redirect URI mudou desde a autorização. Gere um novo link OAuth." >&2
  exit 1
fi

TOKEN_FILE="$(mktemp)"
cleanup() {
  rm -f "$TOKEN_FILE"
}
trap cleanup EXIT

HTTP_STATUS="$(
  curl -sS     -o "$TOKEN_FILE"     -w "%{http_code}"     -X POST "https://oauth2.googleapis.com/token"     -H "Content-Type: application/x-www-form-urlencoded"     --data-urlencode "client_id=$CLIENT_ID"     --data-urlencode "client_secret=$CLIENT_SECRET"     --data-urlencode "code=$AUTH_CODE"     --data-urlencode "redirect_uri=$REDIRECT_URI"     --data-urlencode "grant_type=authorization_code"
)"

if [[ "$HTTP_STATUS" != "200" ]]; then
  ERROR_SUMMARY="$(
    node - "$TOKEN_FILE" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
try {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const message =
    payload.error_description ||
    payload.error ||
    "resposta OAuth sem descrição";
  process.stdout.write(String(message).replace(/[\r\n]+/g, " "));
} catch {
  process.stdout.write("resposta OAuth inválida");
}
NODE
  )"
  echo "Erro ao trocar authorization code (HTTP $HTTP_STATUS): $ERROR_SUMMARY" >&2
  exit 1
fi

REFRESH_TOKEN="$(
  node - "$TOKEN_FILE" <<'NODE'
const fs = require("node:fs");
const payload = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(typeof payload.refresh_token === "string" ? payload.refresh_token : "");
NODE
)"

if [[ -z "$REFRESH_TOKEN" ]]; then
  echo "Erro: o Google não retornou refresh_token." >&2
  echo "Revogue o acesso OAuth anterior da aplicação, gere uma nova autorização e aceite o consentimento novamente." >&2
  exit 1
fi

rm -f "$STATE_FILE"

echo
echo "# Variáveis para .env.local / ambiente de produção"
echo "AUTH_EMAIL_TRANSPORT=gmail-oauth"
if [[ -n "$FROM_ADDRESS" ]]; then
  echo "AUTH_EMAIL_FROM=$FROM_ADDRESS"
fi
echo "AUTH_EMAIL_GOOGLE_CLIENT_ID=$CLIENT_ID"
echo "AUTH_EMAIL_GOOGLE_CLIENT_SECRET=<mantenha-o-valor-ja-configurado>"
echo "AUTH_EMAIL_GOOGLE_REFRESH_TOKEN=$REFRESH_TOKEN"
echo "AUTH_EMAIL_GOOGLE_REDIRECT_URI=$REDIRECT_URI"
echo
echo "# O access_token temporário não é salvo nem exibido."
