/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable external access
  experimental: {
    // Allow external connections
  },
  // Configure hostname
  async rewrites() {
    return []
  },
}

module.exports = nextConfig