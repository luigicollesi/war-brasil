"use client";

import { useEffect, useState } from "react";
import { getDiceFaceTextures } from "@/src/lib/client/dice/dice-assets-manager";
import type {
  DiceFaceTextureSet,
  DiceTextureOptions,
} from "@/src/lib/client/dice/types";

type DiceTextureLoadState = {
  key: string;
  textures: DiceFaceTextureSet | null;
  error: Error | null;
};

function optionsKey({ skin, pipColor, resolution }: DiceTextureOptions) {
  return `${skin}:${pipColor ?? "default"}:${resolution ?? "default"}`;
}

export function useDiceFaceTextures(options: DiceTextureOptions) {
  const { skin, pipColor, resolution } = options;
  const key = optionsKey({ skin, pipColor, resolution });
  const [state, setState] = useState<DiceTextureLoadState>({
    key: "",
    textures: null,
    error: null,
  });

  useEffect(() => {
    let active = true;

    void getDiceFaceTextures({ skin, pipColor, resolution })
      .then((textures) => {
        if (!active) return;
        setState({ key, textures, error: null });
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setState({
          key,
          textures: null,
          error:
            loadError instanceof Error
              ? loadError
              : new Error("Não foi possível preparar as texturas dos dados."),
        });
      });

    return () => {
      active = false;
    };
  }, [key, skin, pipColor, resolution]);

  if (state.key !== key) {
    return { textures: null, error: null };
  }

  return { textures: state.textures, error: state.error };
}
