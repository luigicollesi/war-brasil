"use client";

type GameCommandSyncContext = {
  currentRevision: () => number | null;
  recoverRevision: (revision: number) => Promise<void>;
};

const contextsByRoom = new Map<string, Set<GameCommandSyncContext>>();

export function registerGameCommandSyncContext(
  roomId: string,
  context: GameCommandSyncContext,
) {
  const contexts = contextsByRoom.get(roomId) ?? new Set<GameCommandSyncContext>();
  contexts.add(context);
  contextsByRoom.set(roomId, contexts);

  return () => {
    contexts.delete(context);
    if (contexts.size === 0) contextsByRoom.delete(roomId);
  };
}

export function currentGameCommandRevision(roomId: string) {
  const contexts = contextsByRoom.get(roomId);
  if (!contexts?.size) return null;

  let revision: number | null = null;
  for (const context of contexts) {
    const current = context.currentRevision();
    if (current !== null && (revision === null || current > revision)) {
      revision = current;
    }
  }
  return revision;
}

export async function recoverGameCommandRevision(
  roomId: string,
  revision: number,
) {
  const contexts = contextsByRoom.get(roomId);
  if (!contexts?.size) return;
  await Promise.all(
    [...contexts].map((context) => context.recoverRevision(revision)),
  );
}
