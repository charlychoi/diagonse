import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Include markdown manual in serverless/file tracing for /manual page
  outputFileTracingIncludes: {
    "/manual": ["./USER_MANUAL.md"],
  },
};

export default nextConfig;
