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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`, // This will be evaluated at runtime
      },
    ];
  },
};

export default nextConfig;
