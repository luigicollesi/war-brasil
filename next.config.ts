import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Store/game artwork is already shipped as optimized SVG/WebP assets.
    // Avoid requiring the paid Cloudflare Images binding at runtime.
    unoptimized: true,
  },
  outputFileTracingIncludes: {
    "**/*": [
      "./node_modules/pg-cloudflare/dist/**",
      "./node_modules/pg-cloudflare/esm/**",
    ],
  },
};

export default nextConfig;
