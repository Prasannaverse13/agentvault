/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export: the agent serves these files, so the app and API share one origin.
  output: "export",
  transpilePackages: ["@agentvault/shared"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
