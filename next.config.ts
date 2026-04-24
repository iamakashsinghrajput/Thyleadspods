import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node addons that Turbopack cannot inline — keep them as runtime requires.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
};

export default nextConfig;
