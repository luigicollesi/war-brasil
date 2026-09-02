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
  DICE_SKIN_SOURCES,
} from "./dice-skins";

const imagePromises = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string) {
  const cached = imagePromises.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Texturas de dado só podem ser geradas no navegador."));
      return;
    }

    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível carregar ${src}.`));
    image.src = src;
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

function drawPips(
  context: CanvasRenderingContext2D,
  value: DiceValue,
  resolution: number,
  pipColor: string,
) {
  const radius = resolution * 0.055;
  context.save();
  context.fillStyle = pipColor;
  context.strokeStyle = "rgba(255, 255, 255, 0.48)";
  context.lineWidth = Math.max(1, resolution * 0.006);
  context.shadowColor = "rgba(0, 0, 0, 0.28)";
  context.shadowBlur = resolution * 0.025;
  context.shadowOffsetY = resolution * 0.012;

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
}: {
  skin: DiceSkin;
  value: DiceValue;
  pipColor?: string;
  resolution?: number;
}): Promise<Texture> {
  const source = DICE_SKIN_SOURCES[skin];
  const image = await loadImage(source);
  const canvas = createCanvas(resolution);
  const context = canvas.getContext("2d", { alpha: true });

  if (!context) {
    throw new Error("Canvas 2D indisponível para gerar a face do dado.");
  }

  context.clearRect(0, 0, resolution, resolution);
  context.drawImage(image, 0, 0, resolution, resolution);
  drawPips(context, value, resolution, pipColor);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = `war-brasil-die-${skin}-${value}`;

  return texture;
}

export function clearDiceSourceImageCache() {
  imagePromises.clear();
}
