import "server-only";

export class BoundedJsonBodyError extends Error {
  readonly code: "INVALID_JSON" | "BODY_TOO_LARGE";
  readonly status: number;

  constructor(code: "INVALID_JSON" | "BODY_TOO_LARGE", message: string, status: number) {
    super(message);
    this.name = "BoundedJsonBodyError";
    this.code = code;
    this.status = status;
  }
}

export async function readBoundedJsonBody(
  request: Request,
  maxBytes = 4_096,
): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) {
      throw new BoundedJsonBodyError(
        "BODY_TOO_LARGE",
        "O conteúdo enviado excede o limite permitido.",
        413,
      );
    }
  }

  if (!request.body) {
    throw new BoundedJsonBodyError(
      "INVALID_JSON",
      "Corpo JSON inválido.",
      400,
    );
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new BoundedJsonBodyError(
          "BODY_TOO_LARGE",
          "O conteúdo enviado excede o limite permitido.",
          413,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoundedJsonBodyError(
      "INVALID_JSON",
      "Corpo JSON inválido.",
      400,
    );
  }
}
