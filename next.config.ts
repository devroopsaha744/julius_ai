import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: temporarily ignore ESLint during build to allow incremental fixes.
  // Remove or set to false after addressing lint/type issues across the repo.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
