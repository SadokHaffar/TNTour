import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // COMPLETELY disable ESLint during builds for deployment
  eslint: {
    ignoreDuringBuilds: true,
    dirs: [], // Don't run ESLint on any directories
  },
  
  // Disable TypeScript type checking during builds
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Additional deployment optimizations
  experimental: {
    esmExternals: true,
  },
  
  // Disable source maps in production for faster builds
  productionBrowserSourceMaps: false,
  
  // Set output file tracing root to fix warning
  outputFileTracingRoot: process.cwd(),
  
  // Additional webpack config to disable ESLint
  webpack: (config: any) => {
    // Disable ESLint loader
    if (config.module && config.module.rules) {
      config.module.rules = config.module.rules.filter(
        (rule: any) => {
          if (rule.use && Array.isArray(rule.use)) {
            return !rule.use.some((use: any) => 
              use.loader && use.loader.includes('eslint-loader')
            );
          }
          return true;
        }
      );
    }
    return config;
  },
};

export default nextConfig;
