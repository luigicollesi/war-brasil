import "server-only";

import {
  authenticationRequiredResponse,
  getAuthenticatedSession,
} from "../auth/auth-guard";
import { rejectUntrustedMutationOrigin } from "../auth/request-origin";
import { SocialServiceError } from "./social-service";

const HANDLE_PATTERN = /^[A-Za-z0-9._-]{3,32}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ProfileRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ProfileRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function requireProfileMutationActor(request: Request) {
  const originRejection = rejectUntrustedMutationOrigin(request);
  if (originRejection) return { response: originRejection } as const;

  const session = await getAuthenticatedSession(request);
  if (!session) {
    return { response: authenticationRequiredResponse() } as const;
  }
  return { userId: session.user.id } as const;
}

export function requireCommanderHandle(value: string) {
  const handle = value.trim();
  if (!HANDLE_PATTERN.test(handle)) {
    throw new ProfileRequestError(
      "INVALID_HANDLE",
      "Handle de comandante inválido.",
    );
  }
  return handle;
}

export async function readHandlePayload(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    throw new ProfileRequestError("INVALID_JSON", "Corpo JSON inválido.");
  }

  const handle =
    payload && typeof payload === "object" && "handle" in payload
      ? String(payload.handle ?? "")
      : "";
  return requireCommanderHandle(handle);
}

export function requireRequestId(value: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new ProfileRequestError(
      "INVALID_REQUEST_ID",
      "Identificador de solicitação inválido.",
    );
  }
  return value;
}

export function profileMutationErrorResponse(error: unknown) {
  if (error instanceof ProfileRequestError) {
    return Response.json(
      { error: error.code, message: error.message },
      { status: error.status },
    );
  }

  if (error instanceof SocialServiceError) {
    const status =
      error.code === "COMMANDER_NOT_FOUND" || error.code === "REQUEST_NOT_FOUND"
        ? 404
        : error.code === "RELATION_BLOCKED" ||
            error.code === "FRIEND_REQUESTS_DISABLED" ||
            error.code === "MUTUAL_CONTACT_REQUIRED"
          ? 403
          : 409;
    return Response.json(
      { error: error.code, message: error.message },
      { status },
    );
  }

  console.error("Falha na mutação social do Profile.", error);
  return Response.json(
    {
      error: "PROFILE_SOCIAL_UNAVAILABLE",
      message: "A Rede de Comando está temporariamente indisponível.",
    },
    { status: 503 },
  );
}
