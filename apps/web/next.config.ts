import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@custom-contest/contracts"],
  allowedDevOrigins: ['192.168.33.27', '*.trycloudflare.com']
};

export default nextConfig;
