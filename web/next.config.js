/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // On Railway: proxy /api/* to BFF via private networking.
  // Locally: nginx handles this, so BFF_INTERNAL_URL is not set → no rewrites.
  async rewrites() {
    const bffUrl = process.env.BFF_INTERNAL_URL;
    if (!bffUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${bffUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
