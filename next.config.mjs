/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: false,
  allowedDevOrigins: ['192.168.2.83'],
  async rewrites() {
    return [
      { source: '/favicon.ico', destination: '/icon.png' },
    ]
  },
}

export default nextConfig
