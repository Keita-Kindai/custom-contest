import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@custom-contest/contracts"],
  allowedDevOrigins: ['192.168.0.35']
};

export default nextConfig;
