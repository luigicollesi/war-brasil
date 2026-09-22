import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  type Texture,
} from "three";
import { DICE_PIP_LAYOUT_PERCENT } from "../pip-layout";
import type { DiceSkin, DiceValue } from "../types";
import {
  DEFAULT_DICE_PIP_COLOR,
  DEFAULT_DICE_TEXTURE_RESOLUTION,
  DICE_PROCEDURAL_PALETTES,
} from "./dice-skins";

const imagePromises = new Map<string, Promise<HTMLImageElement>>();
const BODY_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const DICE_ASSET_KEY_PATTERN =
  /^cosmetics\\/dice\\/[a-z0-9][a-z0-9-]*\\/(?:attack|defense|neutral)\\.webp$/;

function diceAssetProxyFallback(src: string) {
  if (typeof window === "undefined") return null;

  try {
    const url = new URL(src, window.location.href);
    if (url.origin === window.location.origin) return null;

    const objectKey = decodeURIComponent(url.pathname.replace(/^\\/+/, ""));
    if (!DICE_ASSET_KEY_PATTERN.test(objectKey)) return null;

    return `/api/assets/dice?key=${encodeURIComponent(objectKey)}`;
  } catch {
    return null;
  }
}

function loadDiceSourceImageCandidate(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Texturas de dado só podem ser geradas no navegador."));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    // Cross-origin CDN assets need CORS to remain origin-clean for CanvasTexture.
    // The same-origin authenticated fallback below also works with this mode.
    image.crossOrigin = "anonymous";
    image.onload = () => {
      if (typeof image.decode !== "function") {
        resolve(image);
        return;
      }
      void image.decode().then(
        () => resolve(image),
        () => resolve(image),
      );
    };
    image.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
    image.src = src;
  });
}

export function preloadDiceSourceImage(src: string) {
  const cached = imagePromises.get(src);
  if (cached) return cached;

  const promise = loadDiceSourceImageCandidate(src).catch(async (primaryError) => {
    const fallback = diceAssetProxyFallback(src);
    if (!fallback) throw primaryError;
    return loadDiceSourceImageCandidate(fallback);
  });

  imagePromises.set(src, promise);
  promise.catch(() => imagePromises.delete(src));
  return promise;
}

function createCanvas(resolution: number) {
  if (typeof document === "undefined") {
    throw new Error("Canvas de dado só pode ser criado no navegador.");
  }
  if (!Number.isInteger(resolution) || resolution < 128 || resolution > 2048) {
    throw new Error("resolution deve ser um inteiro entre 128 e 2048.");
  }

  const canvas = document.createElement("canvas");
  canvas.width = resolution;
  canvas.height = resolution;
  return canvas;
}

function validBodyColor(bodyColor: string | null | undefined) {
  return bodyColor && BODY_COLOR_PATTERN.test(bodyColor) ? bodyColor : null;
}

function drawProceduralBase(
  context: CanvasRenderingContext2D,
  skin: DiceSkin,
  resolution: number,
) {
  const palette = DICE_PROCEDURAL_PALETTES[skin];
  const gradient = context.createLinearGradient(0, 0, resolution, resolution);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(1, palette.bottom);

  context.save();
  context.fillStyle = gradient;
  context.fillRect(0, 0, resolution, resolution);

  const inset = resolution * 0.045;
  const radius = resolution * 0.11;
  context.strokeStyle = palette.edge;
  context.lineWidth = Math.max(2, resolution * 0.018);
  context.beginPath();
  context.roundRect(
    inset,
    inset,
    resolution - inset * 2,
    resolution - inset * 2,
    radius,
  );
  context.stroke();

  const highlight = context.createRadialGradient(
    resolution * 0.28,
    resolution * 0.22,
    0,
    resolution * 0.28,
    resolution * 0.22,
    resolution * 0.72,
  );
  highlight.addColorStop(0, palette.highlight);
  highlight.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = highlight;
  context.fillRect(0, 0, resolution, resolution);
  context.restore();
}

function drawPips(
  context: CanvasRenderingContext2D,
  value: DiceValue,
  resolution: number,
  pipColor: string,
) {
  const radius = resolution * 0.055;
  context.save();
  context.fillStyle = pipColor;
  context.strokeStyle = "rgba(0, 0, 0, 0.9)";
  context.lineWidth = Math.max(1.5, resolution * 0.009);
  context.shadowColor = "rgba(0, 0, 0, 0.34)";
  context.shadowBlur = resolution * 0.022;
  context.shadowOffsetY = resolution * 0.01;

  for (const [xPercent, yPercent] of DICE_PIP_LAYOUT_PERCENT[value]) {
    const x = (xPercent / 100) * resolution;
    const y = (yPercent / 100) * resolution;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.restore();
}

export async function createDiceFaceTexture({
  skin,
  value,
  pipColor = DEFAULT_DICE_PIP_COLOR,
  resolution = DEFAULT_DICE_TEXTURE_RESOLUTION,
  assetRef,
  bodyColor,
}: {
  skin: DiceSkin;
  value: DiceValue;
  pipColor?: string;
  resolution?: number;
  assetRef?: string | null;
  bodyColor?: string | null;
}): Promise<Texture> {
  const canvas = createCanvas(resolution);
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas 2D indisponível para gerar a face do dado.");
  }

  context.clearRect(0, 0, resolution, resolution);

  const hasBodyColor = validBodyColor(bodyColor) !== null;

  let source = `procedural:${skin}`;
  if (assetRef) {
    try {
      const image = await preloadDiceSourceImage(assetRef);
      context.drawImage(image, 0, 0, resolution, resolution);
      source = assetRef;
    } catch {
      // Cosmetic delivery is presentation-only. A failed request degrades to
      // a network-independent base without affecting authoritative dice state.
      if (!hasBodyColor) drawProceduralBase(context, skin, resolution);
    }
  } else if (!hasBodyColor) {
    drawProceduralBase(context, skin, resolution);
  }

  drawPips(context, value, resolution, pipColor);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = `war-brasil-die-${skin}-${value}:${source}`;
  texture.userData.diceSource = source;

  return texture;
}

export function clearDiceSourceImageCache() {
  imagePromises.clear();
}
