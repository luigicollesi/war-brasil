"use client";

import { useEffect, useMemo, useState } from "react";
import type { CosmeticSlot } from "@/src/lib/economy/economy-contract";

type BodyColorLoadState = Readonly<{
  key: string;
  bodyColor: string | null | undefined;
}>;

const bodyColorCache = new Map<string, string | null>();

function assetObjectKey(assetRef: string | null) {
  if (!assetRef) return null;

  try {
    const url = new URL(assetRef, "https://war-brasil.local");
    if (url.pathname !== "/api/assets/dice") return null;
    return url.searchParams.get("key")?.trim() || null;
  } catch {
    return null;
  }
}

export function useDiceBodyColor(
  assetRef: string | null,
  slot: CosmeticSlot,
): string | null | undefined {
  const objectKey = useMemo(() => assetObjectKey(assetRef), [assetRef]);
  const requestKey = objectKey ? `${slot}:${objectKey}` : "";
  const [state, setState] = useState<BodyColorLoadState>({
    key: "",
    bodyColor: undefined,
  });

  useEffect(() => {
    if (!objectKey) {
      setState({ key: requestKey, bodyColor: null });
      return;
    }

    const cached = bodyColorCache.get(requestKey);
    if (cached !== undefined) {
      setState({ key: requestKey, bodyColor: cached });
      return;
    }

    let active = true;
    setState({ key: requestKey, bodyColor: undefined });

    const query = new URLSearchParams({ key: objectKey, slot });
    void fetch(`/api/assets/dice/metadata?${query.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = (await response.json()) as { bodyColor?: unknown };
        return typeof payload.bodyColor === "string" ? payload.bodyColor : null;
      })
      .catch(() => null)
      .then((bodyColor) => {
        bodyColorCache.set(requestKey, bodyColor);
        if (active) setState({ key: requestKey, bodyColor });
      });

    return () => {
      active = false;
    };
  }, [objectKey, requestKey, slot]);

  if (state.key !== requestKey) return undefined;
  return state.bodyColor;
}
