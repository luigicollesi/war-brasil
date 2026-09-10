#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG="$REPO_ROOT/.context/cpg.config.json"
LOCK="$REPO_ROOT/.context/joern.lock.json"

fail() {
  printf 'CPG build error: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v git >/dev/null 2>&1 || fail "Git is required."
[[ -f "$CONFIG" ]] || fail "Missing $CONFIG"
[[ -f "$LOCK" ]] || fail "Missing $LOCK"

JOERN_VERSION="$(node -e 'const fs=require("fs");const p=process.argv[1];process.stdout.write(JSON.parse(fs.readFileSync(p,"utf8")).version)' "$LOCK")"
CACHE_REL="$(node -e 'const fs=require("fs");const p=process.argv[1];const c=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(c.generated?.cacheDirectory||".context/cache")' "$CONFIG")"
OUTPUT_REL="$(node -e 'const fs=require("fs");const p=process.argv[1];const c=JSON.parse(fs.readFileSync(p,"utf8"));process.stdout.write(c.generated?.cpgDirectory||".context/cpg")' "$CONFIG")"
[[ -n "$JOERN_VERSION" ]] || fail "Joern version is missing from $LOCK"

CACHE_ROOT="$REPO_ROOT/$CACHE_REL"
SOURCE_DIR="$CACHE_ROOT/cpg-source"
OUTPUT_DIR="$REPO_ROOT/$OUTPUT_REL"
OUTPUT_FILE="$OUTPUT_DIR/cpg.bin"

platform_key() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Linux) os="linux" ;;
    Darwin) os="macos" ;;
    *) fail "Unsupported OS: $os. Use JOERN_HOME with a compatible Joern installation." ;;
  esac
  case "$arch" in
    x86_64|amd64) arch="x86_64" ;;
    arm64|aarch64) arch="arm64" ;;
    *) fail "Unsupported architecture: $arch" ;;
  esac
  printf '%s-%s' "$os" "$arch"
}

resolve_cached_joern() {
  local candidate="$CACHE_ROOT/joern/$JOERN_VERSION"
  if [[ -x "$candidate/joern-parse" ]]; then
    printf '%s' "$candidate/joern-parse"
    return 0
  fi
  local found
  found="$(find "$candidate" -maxdepth 3 -type f -name joern-parse -perm -u+x 2>/dev/null | head -n 1 || true)"
  [[ -n "$found" ]] && printf '%s' "$found"
}

bootstrap_joern() {
  command -v curl >/dev/null 2>&1 || fail "curl is required to bootstrap Joern."
  command -v unzip >/dev/null 2>&1 || fail "unzip is required to bootstrap Joern."
  command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required to verify Joern."

  local key asset checksum url archive install_dir actual
  key="$(platform_key)"
  asset="$(node -e 'const fs=require("fs");const p=process.argv[1],k=process.argv[2];const a=JSON.parse(fs.readFileSync(p,"utf8")).assets?.[k];if(!a)process.exit(2);process.stdout.write(a.name)' "$LOCK" "$key")" || fail "No Joern asset pinned for $key"
  checksum="$(node -e 'const fs=require("fs");const p=process.argv[1],k=process.argv[2];const a=JSON.parse(fs.readFileSync(p,"utf8")).assets?.[k];if(!a)process.exit(2);process.stdout.write(a.sha256)' "$LOCK" "$key")" || fail "No checksum pinned for $key"
  url="https://github.com/joernio/joern/releases/download/$JOERN_VERSION/$asset"
  archive="$CACHE_ROOT/joern/$asset"
  install_dir="$CACHE_ROOT/joern/$JOERN_VERSION"

  mkdir -p "$CACHE_ROOT/joern"
  rm -f "$archive.part"
  if [[ ! -f "$archive" ]]; then
    printf 'Downloading pinned Joern %s (%s). The verified archive is removed after extraction.\n' "$JOERN_VERSION" "$key" >&2
    curl --fail --location --retry 3 --output "$archive.part" "$url"
    mv "$archive.part" "$archive"
  fi

  actual="$(sha256sum "$archive" | awk '{print $1}')"
  if [[ "$actual" != "$checksum" ]]; then
    rm -f "$archive"
    fail "Joern archive checksum mismatch for $asset"
  fi

  rm -rf "$install_dir"
  mkdir -p "$install_dir"
  unzip -q "$archive" -d "$install_dir"

  local parser
  parser="$(resolve_cached_joern || true)"
  [[ -n "$parser" ]] || fail "joern-parse was not found after extracting $asset"

  rm -f "$archive"
  printf '%s' "$parser"
}

resolve_joern_parse() {
  if [[ -n "${JOERN_HOME:-}" && -x "$JOERN_HOME/joern-parse" ]]; then
    printf '%s' "$JOERN_HOME/joern-parse"
    return 0
  fi

  local cached
  cached="$(resolve_cached_joern || true)"
  if [[ -n "$cached" ]]; then
    printf '%s' "$cached"
    return 0
  fi

  if [[ "${CPG_BOOTSTRAP_JOERN:-0}" == "1" ]]; then
    bootstrap_joern
    return 0
  fi

  fail "Pinned Joern $JOERN_VERSION is not cached. Set CPG_BOOTSTRAP_JOERN=1 to download it, or set JOERN_HOME to a compatible installation."
}

node "$REPO_ROOT/scripts/context/prepare-cpg-source.mjs" "$REPO_ROOT" "$SOURCE_DIR"
JOERN_PARSE="$(resolve_joern_parse)"

rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

printf 'Generating CPG with Joern %s...\n' "$JOERN_VERSION"
"$JOERN_PARSE" "$SOURCE_DIR" --language JAVASCRIPT --output "$OUTPUT_FILE"

[[ -s "$OUTPUT_FILE" ]] || fail "Joern completed without producing a non-empty $OUTPUT_FILE"

GIT_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
node "$REPO_ROOT/scripts/context/write-cpg-build-metadata.mjs" \
  "$REPO_ROOT" \
  "$SOURCE_DIR/.manifest.json" \
  "$OUTPUT_FILE" \
  "$OUTPUT_DIR/build.json" \
  "$JOERN_VERSION" \
  "$GIT_HEAD"

printf 'CPG generated at %s\n' "${OUTPUT_FILE#$REPO_ROOT/}"
