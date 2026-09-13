import "server-only";

import { readAuthServerEnvironment } from "./environment";

const EXTERNAL_POST_CALLBACK_PREFIX = "/api/auth/callback/";

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function trustedApplicationOrigin(request: Request) {
  const environment = readAuthServerEnvironment();
  const configured = environment.baseUrl
    ? normalizeOrigin(environment.baseUrl)
    : null;

  if (configured) {
    return configured;
  }

  return new URL(request.url).origin;
}

function requestEvidenceOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    return normalizeOrigin(origin);
  }

  const referer = request.headers.get("referer");
  return referer ? normalizeOrigin(referer) : null;
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

  const evidenceOrigin = requestEvidenceOrigin(request);

  // Requests without Origin/Referer remain available to trusted non-browser
  // callers. Browser requests that do expose origin evidence must be first-party.
  if (!evidenceOrigin) {
    return null;
  }

  if (evidenceOrigin === trustedApplicationOrigin(request)) {
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
