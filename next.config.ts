import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Default API URL based on environment
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || (
      process.env.NODE_ENV === 'production'
        ? 'https://cerebrasinference-production-server.up.railway.app'
        : 'http://127.0.0.1:8000'
    ),
  },
  // Ensure we can make requests to the backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/:path*',
      },
    ];
  },
};

export default nextConfig;
