const OPERATIONS_REQUEST_TIMEOUT_MS = 15_000;

export type OperationsRequestFailureKind = "timeout" | "network";

type OperationsRequestOptions = {
  timeoutMs?: number;
  fetcher?: typeof fetch;
};

export class OperationsRequestError extends Error {
  readonly kind: OperationsRequestFailureKind;

  constructor(kind: OperationsRequestFailureKind, message: string) {
    super(message);
    this.name = "OperationsRequestError";
    this.kind = kind;
  }
}

export async function fetchOperationsRequest(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: OperationsRequestOptions = {},
) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? OPERATIONS_REQUEST_TIMEOUT_MS;
  const fetcher = options.fetcher ?? fetch;
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new OperationsRequestError(
        "timeout",
        "Tempo de resposta excedido. Verifique sua conexão e tente novamente.",
      );
    }

    if (error instanceof TypeError) {
      throw new OperationsRequestError(
        "network",
        "Não foi possível concluir a operação por falha de rede. Verifique sua conexão e tente novamente.",
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
