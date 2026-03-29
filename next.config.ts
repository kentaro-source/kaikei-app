import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // pdfjs-dist が Node.js 用 canvas を require するのを無視
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
