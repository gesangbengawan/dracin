import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/cdn/:path*',
        destination: 'http://ec2-100-49-45-36.compute-1.amazonaws.com:3001/stream/:path*',
      },
    ];
  },
};

export default nextConfig;
