import type { NextConfig } from "next";
import { PROFILE_REMOTE_PORTRAIT_HOSTS } from "./src/lib/profile/profile-portrait-policy";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: PROFILE_REMOTE_PORTRAIT_HOSTS.map((hostname) => ({
      protocol: "https" as const,
      hostname,
      port: "",
      pathname: "/**",
    })),
  },
};

export default nextConfig;
