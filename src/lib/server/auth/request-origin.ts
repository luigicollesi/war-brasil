import "server-only";

import { readAuthServerEnvironment } from "./environment";

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

function rejectUntrustedOriginEvidence(request: Request) {
  const evidence = requestEvidenceOrigin(request);

  // Trusted non-browser callers may omit Origin/Referer. Browser-origin evidence,
  // when present, must resolve to the configured War-Brasil application origin.
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

export function rejectUntrustedMutationOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase())) {
    return null;
  }
  return rejectUntrustedOriginEvidence(request);
}

export function rejectUntrustedAuthMutationOrigin(request: Request) {
  if (request.method !== "POST") {
    return null;
  }
  return rejectUntrustedOriginEvidence(request);
}
