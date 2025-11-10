import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true, // Keep it enabled but...
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Option A: simple allowlist
    domains: ["gravatar.com", "www.gravatar.com", "secure.gravatar.com", "s.gravatar.com"],

    // Option B (stricter): match only the /avatar/* path
    remotePatterns: [
      {
        protocol: "https",
        hostname: "gravatar.com",
        pathname: "/avatar/**",
      },
      {
        protocol: "https",
        hostname: "www.gravatar.com",
        pathname: "/avatar/**",
      },
      {
        protocol: "https",
        hostname: "secure.gravatar.com",
        pathname: "/avatar/**",
      },
      {
        protocol: "https",
        hostname: "s.gravatar.com",
        pathname: "/avatar/**",
      },
    ],
  },
  experimental: {
    // Keep these as Node externals in RSC/route handlers
    serverComponentsExternalPackages: [
      "puppeteer-core",
      "resumed",
      "jsonresume-theme-tech",
      "jsonresume-theme-tech-ger",
      "@sparticuz/chromium",
    ],
  }
};

export default nextConfig;
