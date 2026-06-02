import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    // Provide stub env vars so module-level guards don't throw at import time
    env: {
      STRIPE_SECRET_KEY: "sk_test_vitest_stub",
    },
  },
});
