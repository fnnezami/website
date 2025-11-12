import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Remove the deprecated 'domains' field
    remotePatterns: [
      { protocol: "https", hostname: "gravatar.com", pathname: "/avatar/**" },
      { protocol: "https", hostname: "www.gravatar.com", pathname: "/avatar/**" },
      { protocol: "https", hostname: "secure.gravatar.com", pathname: "/avatar/**" },
      { protocol: "https", hostname: "s.gravatar.com", pathname: "/avatar/**" },
    ],
  },
  serverExternalPackages: [
    "puppeteer-core",
    "@sparticuz/chromium",
    "puppeteer", // Add this if you're using regular puppeteer too
    "resumed",
    "jsonresume-theme-tech",
    "jsonresume-theme-tech-ger",
  ],
};

export default nextConfig;
