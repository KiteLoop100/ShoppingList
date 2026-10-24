import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Vite 8 (oxc) honours tsconfig "jsx": "preserve" (needed by Next.js) and then
  // fails to parse .tsx imports. Force the automatic JSX runtime for tests only.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    globals: true,
    environment: "node",
    exclude: ["tests/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
