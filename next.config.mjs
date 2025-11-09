/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@lancedb/lancedb", "better-sqlite3"],
  },
};

export default nextConfig;
