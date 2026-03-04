/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // /api/* requests are handled by app/api/[...path]/route.ts
  // which reads BFF_INTERNAL_URL at request time (not build time)
};

module.exports = nextConfig;
