import "server-only";

import { auth, type AuthSession } from "./auth";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Sessão autenticada obrigatória.");
    this.name = "AuthenticationRequiredError";
  }
}

export async function getAuthenticatedSession(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
    query: {
      disableCookieCache: true,
    },
  });
}

/**
 * Read-only hot paths may use Better Auth's short-lived signed cookie cache to
 * avoid a PostgreSQL session lookup on every poll. Mutating/sensitive routes
 * must keep using getAuthenticatedSession(), which always bypasses the cache.
 */
export async function getAuthenticatedSessionForRead(request: Request) {
  return auth.api.getSession({
    headers: request.headers,
  });
}

export async function getAuthenticatedSessionForReadHeaders(
  requestHeaders: HeadersInit,
) {
  return auth.api.getSession({
    headers: new Headers(requestHeaders),
  });
}

export async function requireAuthenticatedSession(
  request: Request,
): Promise<AuthSession> {
  const session = await getAuthenticatedSession(request);

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  return session;
}

export function authenticationRequiredResponse() {
  return Response.json(
    {
      error: "authentication_required",
      message: "Autenticação necessária para acessar este recurso.",
    },
    { status: 401 },
  );
}

export function forbiddenResponse() {
  return Response.json(
    {
      error: "forbidden",
      message: "A conta autenticada não pode acessar este recurso.",
    },
    { status: 403 },
  );
}

type AuthenticatedApiHandler<TContext> = (
  request: Request,
  session: AuthSession,
  context: TContext,
) => Response | Promise<Response>;

export function withAuthenticatedApi<TContext = undefined>(
  handler: AuthenticatedApiHandler<TContext>,
) {
  return async (request: Request, context: TContext) => {
    const session = await getAuthenticatedSession(request);

    if (!session) {
      return authenticationRequiredResponse();
    }

    return handler(request, session, context);
  };
}
