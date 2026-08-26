import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/assets/[asset]": ["./src/public/**/*"],
  },
};

export default nextConfig;
