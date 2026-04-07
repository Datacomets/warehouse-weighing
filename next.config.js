/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  transpilePackages: ["@react-pdf/renderer"],
};

module.exports = nextConfig;
