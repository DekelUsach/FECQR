import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't fail the Vercel build on TypeScript errors
  typescript: {
    ignoreBuildErrors: true,
  },
  // xlsx depends on Node built-ins; keep it server-side only
  serverExternalPackages: ['xlsx'],
};

export default nextConfig;
