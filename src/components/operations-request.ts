const OPERATIONS_REQUEST_TIMEOUT_MS = 15_000;

export type OperationsRequestFailureKind = "timeout" | "network";

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
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    OPERATIONS_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(input, {
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
    window.clearTimeout(timeoutId);
  }
}
