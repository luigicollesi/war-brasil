import { readFile } from "node:fs/promises";
import path from "node:path";

const assets = {
  "card-coringa.png": "image/png",
  "card-template.png": "image/png",
  "dado-brasil-hq.svg": "image/svg+xml",
  "dado-brasil-v1.png": "image/png",
  "gold-bar.svg": "image/svg+xml",
  "leaf.svg": "image/svg+xml",
  "troop-piece.svg": "image/svg+xml",
  "war-brasil-42.production.svg": "image/svg+xml",
  "water-drop.svg": "image/svg+xml",
} as const;

type AssetName = keyof typeof assets;

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ asset: string }> }) {
  const { asset } = await params;
  if (!Object.hasOwn(assets, asset)) return new Response("Ativo não encontrado.", { status: 404 });

  const name = asset as AssetName;
  const file = await readFile(path.join(process.cwd(), "src", "public", name));
  return new Response(file, {
    headers: {
      "Content-Type": assets[name],
      "Cache-Control": "public, max-age=3600",
    },
  });
}
