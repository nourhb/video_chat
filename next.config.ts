import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable static exports for better deployment compatibility
  output: 'standalone',
  
  // Configure trailing slashes for better routing
  trailingSlash: false,
  
  // Disable image optimization for deployment
  images: {
    unoptimized: true,
  },
  
  // Configure headers for proper MIME types
  async headers() {
    return [
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
        ],
      },
    ];
  },
  
  // Configure webpack for better production builds
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Experimental features
  experimental: {
    appDir: true,
  },
};

export default nextConfig;
