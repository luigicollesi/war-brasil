const OPERATIONS_REQUEST_TIMEOUT_MS = 15_000;

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
      throw new Error(
        "Tempo de resposta excedido. Verifique sua conexão e tente novamente.",
      );
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
