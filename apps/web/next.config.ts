import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2", "iconv-lite"],
  transpilePackages: ["@skynet/config", "@skynet/db", "@skynet/sdk"],
  allowedDevOrigins: [
    "http://skynet.latentvibe.com",
    "https://skynet.latentvibe.com",
    "skynet.latentvibe.com",
  ],
  webpack: (config, { isServer }) => {
    if (isServer && Array.isArray(config.externals)) {
      config.externals.push(
        (
          { request }: { request?: string },
          callback: (err?: Error | null, result?: string) => void,
        ) => {
          if (
            request &&
            (request.startsWith("node:") ||
              request === "mysql2" ||
              request === "mysql2/promise" ||
              request.startsWith("mysql2/") ||
              request === "iconv-lite" ||
              request.startsWith("iconv-lite/"))
          ) {
            return callback(null, "commonjs " + request);
          }
          callback();
        },
      );
    }
    return config;
  },
};

export default nextConfig;
