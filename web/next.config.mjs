/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@agentvault/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
