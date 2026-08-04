import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/photo-**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/for-organisations",
        destination: "/organisation",
        permanent: true,
      },
      {
        source: "/organisations/start",
        destination: "/organisation/start",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
