import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native Node addons that Turbopack cannot inline — keep them as runtime requires.
  serverExternalPackages: ["@resvg/resvg-js", "sharp"],
  // Ship the Inter TTF files with the serverless function bundle so resvg can find them
  // at runtime on Vercel (they're read via fs, not imported, so Next's default tracer
  // wouldn't otherwise include them).
  outputFileTracingIncludes: {
    "/api/signatures/shine-animation": ["./fonts/**/*"],
  },
};

export default nextConfig;
