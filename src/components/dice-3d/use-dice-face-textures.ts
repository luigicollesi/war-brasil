"use client";

import { useEffect, useState } from "react";
import { getDiceFaceTextures } from "@/src/lib/client/dice/dice-assets-manager";
import type {
  DiceFaceTextureSet,
  DiceTextureOptions,
} from "@/src/lib/client/dice/types";

export function useDiceFaceTextures(options: DiceTextureOptions) {
  const [textures, setTextures] = useState<DiceFaceTextureSet | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const { skin, pipColor, resolution } = options;

  useEffect(() => {
    let active = true;
    setTextures(null);
    setError(null);

    void getDiceFaceTextures({ skin, pipColor, resolution })
      .then((nextTextures) => {
        if (active) setTextures(nextTextures);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError
            : new Error("Não foi possível preparar as texturas dos dados."),
        );
      });

    return () => {
      active = false;
    };
  }, [skin, pipColor, resolution]);

  return { textures, error };
}
