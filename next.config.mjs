/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@lancedb/lancedb", "better-sqlite3"],
};

export default nextConfig;
