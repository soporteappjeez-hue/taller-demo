/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverRuntimeConfig: { port: process.env.PORT || 3001 },
};
module.exports = nextConfig;
