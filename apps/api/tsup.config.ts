import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // Bundle workspace packages into the output, keep everything else external.
  // This means node_modules stay as imports resolved at runtime.
  noExternal: ["@nova/shared", "@nova/db"],
  dts: false,
  sourcemap: true,
});
