import { defineConfig } from "vitest/config";

/**
 * Coverage misst nur die Berechnungsschicht; die Schwelle greift bei
 * `npm run test:coverage`, nicht im normalen Testlauf.
 */
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/calculations/**"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
      reporter: ["text", "html"],
      thresholds: { lines: 90 },
    },
  },
});
