const createNextIntlPlugin = require("next-intl/plugin");

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  // Vercel expects .next; locally avoid Dropbox locking by using a cache dir
  distDir: process.env.VERCEL ? ".next" : "node_modules/.cache/next-build",
};

// PWA: enable only in production to avoid dev issues; uncomment when ready
// const withPWA = require("next-pwa")({ dest: "public", disable: process.env.NODE_ENV === "development" });
// module.exports = withPWA(withNextIntl(nextConfig));

module.exports = withNextIntl(nextConfig);
