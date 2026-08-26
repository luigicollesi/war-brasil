import "server-only";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { RoomError } from "@/src/lib/rooms";

type ApiErrorContext = {
  operation: string;
  route?: string;
  resource?: Record<string, string | number | boolean | null | undefined>;
  input?: unknown;
};

type DatabaseError = {
  code?: unknown;
  constraint?: unknown;
  detail?: unknown;
  table?: unknown;
  schema?: unknown;
  routine?: unknown;
};

function noStoreHeaders(init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return headers;
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data ?? {}, {
    ...init,
    headers: noStoreHeaders(init),
  });
}

export function noStoreEmpty(init?: ResponseInit) {
  return new Response(null, {
    ...init,
    headers: noStoreHeaders(init),
  });
}

function describeInput(value: unknown): unknown {
  if (Array.isArray(value)) return `[array:${value.length}]`;
  if (typeof value !== "object" || value === null) return typeof value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      if (Array.isArray(item)) return [key, `[array:${item.length}]`];
      if (typeof item === "string") return [key, `[string:${item.length}]`];
      if (item === null) return [key, null];
      return [key, typeof item];
    }),
  );
}

function describeError(error: unknown) {
  if (error instanceof Error) {
    const database = error as Error & DatabaseError;
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      database: {
        code: database.code,
        constraint: database.constraint,
        detail: database.detail,
        table: database.table,
        schema: database.schema,
        routine: database.routine,
      },
      domain: error instanceof RoomError ? error.debug : undefined,
    };
  }

  return { value: String(error) };
}

function unexpectedClientMessage(error: unknown, debugId: string) {
  const base = `Não foi possível concluir esta operação. Informe o diagnóstico ${debugId}.`;
  if (process.env.NODE_ENV === "production" || !(error instanceof Error)) return base;

  const database = error as Error & DatabaseError;
  const databaseCode = typeof database.code === "string" ? ` [${database.code}]` : "";
  const constraint = typeof database.constraint === "string" ? ` (${database.constraint})` : "";
  return `${base} Motivo técnico: ${error.message}${databaseCode}${constraint}`;
}

/**
 * Produz uma resposta segura para o cliente e um log correlacionável no servidor.
 * Nunca passe sessões, cookies ou valores brutos de formulário neste contexto.
 */
export function roomErrorResponse(error: unknown, context: ApiErrorContext) {
  const debugId = randomUUID().slice(0, 8);
  const diagnostic = {
    debugId,
    operation: context.operation,
    route: context.route,
    resource: context.resource,
    input: describeInput(context.input),
    error: describeError(error),
  };

  if (error instanceof RoomError) {
    console.warn("[war-brasil] operação recusada", diagnostic);
    return noStoreJson({ error: error.message, debugId }, { status: error.status });
  }

  console.error("[war-brasil] falha inesperada na operação", diagnostic);
  return noStoreJson(
    {
      // Em desenvolvimento, o cliente também recebe a mensagem técnica sem stack
      // ou dados da requisição. Produção continua expondo apenas o diagnóstico.
      error: unexpectedClientMessage(error, debugId),
      debugId,
    },
    { status: 500 },
  );
}

export async function readJsonObject(request: Request) {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    // A resposta abaixo é a mesma para JSON ausente ou inválido.
  }

  throw new RoomError("Envie os dados da solicitação em JSON válido.", 400);
}
