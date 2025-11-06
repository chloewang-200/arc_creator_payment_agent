import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Disable Fast Refresh error overlay to prevent auto-reload on errors
  reactStrictMode: true,
  // Prevent page reload on runtime errors
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
