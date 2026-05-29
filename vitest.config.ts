import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@render-experiment/utils": resolve(__dirname, "./packages/shared/utils/src"),
      "@render-experiment/tooltip-shared": resolve(__dirname, "./packages/shared/components/tooltip/src"),
      "@render-experiment/dropdown-menu-shared": resolve(__dirname, "./packages/shared/components/dropdown-menu/src"),
      "@render-experiment/store": resolve(__dirname, "./packages/core/store/src"),
      "@render-experiment/store-react": resolve(
        __dirname,
        "./packages/react/store/src",
      ),
      "@render-experiment/machine-core": resolve(
        __dirname,
        "./packages/core/machine/src",
      ),
      "@render-experiment/machine-react": resolve(
        __dirname,
        "./packages/react/machine/src",
      ),
      "@render-experiment/style-engine-react": resolve(
        __dirname,
        "./packages/react/style-engine/src",
      ),
      "@render-experiment/tooltip-core": resolve(
        __dirname,
        "./packages/core/components/tooltip/src",
      ),
      "@render-experiment/tooltip-react": resolve(
        __dirname,
        "./packages/react/components/tooltip/src",
      ),
    },
  },
  test: {
    globals: false,
    // jsdom only kicks in for files that opt in via `@vitest-environment jsdom`.
    environment: "node",
  },
});
