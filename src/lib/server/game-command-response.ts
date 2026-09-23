import "server-only";

import { noStoreJson } from "@/src/lib/api-response";
import { GAME_REVISION_HEADER } from "@/src/lib/game-sync-contract";

type VersionedCommandResult = {
  revision: number;
  baseRevision: number;
  patch?: unknown;
  privatePatch?: unknown;
};

function revisionHeaders(revision: number) {
  return {
    headers: {
      [GAME_REVISION_HEADER]: String(revision),
    },
  };
}

export function gameCommandPatchResponse(result: VersionedCommandResult) {
  return noStoreJson(
    {
      revision: result.revision,
      baseRevision: result.baseRevision,
      ...(result.patch ? { patch: result.patch } : {}),
      ...(result.privatePatch ? { privatePatch: result.privatePatch } : {}),
    },
    revisionHeaders(result.revision),
  );
}

export function gameCommandValueResponse(
  result: VersionedCommandResult & { value: object },
) {
  return noStoreJson(
    {
      ...result.value,
      revision: result.revision,
      baseRevision: result.baseRevision,
      ...(result.patch ? { patch: result.patch } : {}),
      ...(result.privatePatch ? { privatePatch: result.privatePatch } : {}),
    },
    revisionHeaders(result.revision),
  );
}
