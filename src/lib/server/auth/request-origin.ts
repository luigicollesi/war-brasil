import "server-only";

import { readAuthServerEnvironment } from "./environment";

const EXTERNAL_POST_CALLBACK_PREFIX = "/api/auth/callback/";

type OriginEvidence =
  | { present: false }
  | { origin: string | null; present: true };

function normalizeOrigin(value: string) {
  try {
    const origin = new URL(value).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function isTrustedApplicationOrigin(origin: string, request: Request) {
  const environment = readAuthServerEnvironment();
  const candidate = new URL(origin);
  const configuredOrigin = environment.baseUrl
    ? normalizeOrigin(environment.baseUrl)
    : null;

  if (configuredOrigin === origin) {
    return true;
  }

  if (environment.allowedHosts.includes(candidate.host)) {
    return candidate.protocol === "https:" || isLocalHostname(candidate.hostname);
  }

  // Development without explicit auth URL/host allowlist may use the request's
  // own origin. Production fail-fast requires BETTER_AUTH_URL, so this fallback
  // cannot silently become the production authority.
  return (
    !configuredOrigin &&
    environment.allowedHosts.length === 0 &&
    origin === new URL(request.url).origin
  );
}

function requestEvidenceOrigin(request: Request): OriginEvidence {
  const origin = request.headers.get("origin");
  if (origin !== null) {
    return { origin: normalizeOrigin(origin), present: true };
  }

  const referer = request.headers.get("referer");
  if (referer !== null) {
    return { origin: normalizeOrigin(referer), present: true };
  }

  return { present: false };
}

export function isExternalAuthProviderCallback(request: Request) {
  if (request.method !== "POST") {
    return false;
  }

  return new URL(request.url).pathname.startsWith(EXTERNAL_POST_CALLBACK_PREFIX);
}

export function rejectUntrustedAuthMutationOrigin(request: Request) {
  if (request.method !== "POST" || isExternalAuthProviderCallback(request)) {
    return null;
  }

  const evidence = requestEvidenceOrigin(request);

  // Requests with no Origin/Referer remain available to trusted non-browser
  // callers. Once a caller supplies browser-origin evidence it must parse and
  // match an explicitly trusted application origin.
  if (!evidence.present) {
    return null;
  }

  if (
    evidence.origin &&
    isTrustedApplicationOrigin(evidence.origin, request)
  ) {
    return null;
  }

  return Response.json(
    {
      code: "INVALID_ORIGIN",
      message: "Origem de autenticação não autorizada.",
    },
    { status: 403 },
  );
}
