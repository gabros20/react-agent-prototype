/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@lancedb/lancedb", "better-sqlite3"],

  // Proxy image uploads to Express server
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://localhost:8787/uploads/:path*',
      },
    ];
  },
};

export default nextConfig;
