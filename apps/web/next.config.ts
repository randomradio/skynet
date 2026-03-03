import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@skynet/db", "@skynet/sdk"],
};

export default nextConfig;
