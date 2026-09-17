export const DEFAULT_DICE_BODY_COLOR = "#D0AD5A";

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

function normalizeHexColor(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed && HEX_COLOR_PATTERN.test(trimmed)
    ? trimmed.toUpperCase()
    : null;
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function rgbToHsl(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) return { h: 0, s: 0, l: lightness };

  const saturation =
    lightness > 0.5
      ? delta / (2 - max - min)
      : delta / (max + min);
  let hue: number;
  if (max === rn) hue = (gn - bn) / delta + (gn < bn ? 6 : 0);
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;

  return { h: hue / 6, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, t: number) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToRgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, h) * 255),
    b: Math.round(hueToRgb(p, q, h - 1 / 3) * 255),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function deriveDiceBodyHighlight(bodyColor: string) {
  const normalized = normalizeHexColor(bodyColor) ?? DEFAULT_DICE_BODY_COLOR;
  const { r, g, b } = hexToRgb(normalized);
  const { h, s, l } = rgbToHsl(r, g, b);
  const highlightLightness = Math.min(0.82, l + (1 - l) * 0.18);
  const highlightSaturation = Math.max(0, Math.min(1, s * 0.92));
  const highlight = hslToRgb(h, highlightSaturation, highlightLightness);
  return rgbToHex(highlight.r, highlight.g, highlight.b);
}

export function resolveDiceBodyColors(
  bodyColor?: string | null,
  bodyHighlightColor?: string | null,
) {
  const resolvedBodyColor =
    normalizeHexColor(bodyColor) ?? DEFAULT_DICE_BODY_COLOR;
  return {
    bodyColor: resolvedBodyColor,
    bodyHighlightColor:
      normalizeHexColor(bodyHighlightColor) ??
      deriveDiceBodyHighlight(resolvedBodyColor),
  };
}
