import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // Bundle everything into a single file except node built-ins
  // and packages that need to stay external (native modules)
  noExternal: [/(.*)/],
  external: [
    // Node built-ins
    "node:*",
    // Native modules that can't be bundled
    "postgres",
    "bcryptjs",
    "ioredis",
  ],
  // Don't generate declaration files (not needed for runtime)
  dts: false,
  sourcemap: true,
});
