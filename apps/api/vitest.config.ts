import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/**
 * Vitest transformiert TS standardmäßig mit esbuild
 * (keine emitDecoratorMetadata) ohne die NestJS-DI, deshalb SWC
 */
export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        target: "es2022",
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
      module: { type: "es6" },
    }),
  ],
  test: {
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
