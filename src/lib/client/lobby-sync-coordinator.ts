export type LobbySyncRequest = () => Promise<void>;

export function createLobbySyncCoordinator(runRequest: LobbySyncRequest) {
  let inFlight: Promise<void> | null = null;

  function sync() {
    if (inFlight) return inFlight;

    const request = runRequest();
    const tracked = request.finally(() => {
      if (inFlight === tracked) inFlight = null;
    });

    inFlight = tracked;
    return tracked;
  }

  async function refreshAfterCurrent() {
    const current = inFlight;
    if (current) {
      try {
        await current;
      } catch {
        // A atualização explícita é também o caminho de retry: uma leitura
        // anterior com falha não pode impedir a próxima leitura fresca.
      }
    }

    return sync();
  }

  return {
    sync,
    refreshAfterCurrent,
  };
}
