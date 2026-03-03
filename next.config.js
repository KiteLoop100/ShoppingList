const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Vercel expects .next; locally avoid Dropbox locking by using a cache dir
  distDir: process.env.VERCEL ? ".next" : "node_modules/.cache/next-build",
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self)" },
        ],
      },
    ];
  },
};

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/products/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "product-api-cache",
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/categories/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "category-api-cache",
        expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      urlPattern: /\/_next\/static\/.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.*/,
      handler: "CacheFirst",
      options: {
        cacheName: "next-images",
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

const baseConfig = withPWA(withNextIntl(nextConfig));

try {
  if (process.env.SENTRY_ORG) {
    const { withSentryConfig } = require("@sentry/nextjs");
    module.exports = withSentryConfig(
      baseConfig,
      {
        silent: true,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
      {
        widenClientFileUpload: true,
        hideSourceMaps: true,
        disableLogger: true,
      }
    );
  } else {
    module.exports = baseConfig;
  }
} catch {
  module.exports = baseConfig;
}
