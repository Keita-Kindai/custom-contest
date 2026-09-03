import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@custom-contest/contracts"],
};

export default nextConfig;
