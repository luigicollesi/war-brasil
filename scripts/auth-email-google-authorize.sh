#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_REDIRECT_URI="http://localhost:3000/api/google/callback"
STATE_FILE="${TMPDIR:-/tmp}/war-brasil-google-mailer-oauth-${UID:-user}.state"

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
REDIRECT_URI="$(read_env_value AUTH_EMAIL_GOOGLE_REDIRECT_URI)"
FROM_ADDRESS="$(read_env_value AUTH_EMAIL_FROM)"

if [[ -z "$CLIENT_ID" ]]; then
  echo "Erro: AUTH_EMAIL_GOOGLE_CLIENT_ID não está configurado no ambiente, .env.local ou .env." >&2
  exit 1
fi

if [[ -z "$REDIRECT_URI" ]]; then
  REDIRECT_URI="$DEFAULT_REDIRECT_URI"
fi

STATE="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("hex"))')"

umask 077
printf '%s\n%s\n' "$STATE" "$REDIRECT_URI" > "$STATE_FILE"

AUTH_URL="$(
  node - "$CLIENT_ID" "$REDIRECT_URI" "$STATE" <<'NODE'
const [clientId, redirectUri, state] = process.argv.slice(2);
const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
url.searchParams.set("client_id", clientId);
url.searchParams.set("redirect_uri", redirectUri);
url.searchParams.set("response_type", "code");
url.searchParams.set("scope", "https://www.googleapis.com/auth/gmail.send");
url.searchParams.set("access_type", "offline");
url.searchParams.set("prompt", "consent");
url.searchParams.set("include_granted_scopes", "true");
url.searchParams.set("state", state);
process.stdout.write(url.toString());
NODE
)"

echo "Google OAuth para o remetente de autenticação"
echo
if [[ -n "$FROM_ADDRESS" ]]; then
  echo "Remetente configurado: $FROM_ADDRESS"
fi
echo "Redirect local/manual: $REDIRECT_URI"
echo
echo "IMPORTANTE:"
echo "- cadastre exatamente esse Redirect URI no cliente OAuth do Google Cloud;"
echo "- NÃO existe rota de callback correspondente no WAR Brasil;"
echo "- depois do consentimento, a página local pode dar 404/erro de conexão;"
echo "- copie a URL inteira da barra do navegador, incluindo ?code=...&state=...."
echo
echo "URL de autorização:"
echo "$AUTH_URL"
echo

open_browser() {
  local url="$1"

  if command -v wslview >/dev/null 2>&1; then
    wslview "$url" >/dev/null 2>&1 &
    return 0
  fi

  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 &
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1
    return 0
  fi

  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c start "" "$url" >/dev/null 2>&1
    return 0
  fi

  return 1
}

if open_browser "$AUTH_URL"; then
  echo "Navegador aberto."
else
  echo "Não encontrei um comando para abrir o navegador automaticamente."
  echo "Abra manualmente a URL acima."
fi

echo
echo "Depois, execute:"
echo "  bash scripts/auth-email-google-exchange.sh 'URL_COMPLETA_COPIADA_DO_NAVEGADOR'"
