import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  // Bundle app code but keep Node built-ins and native packages external
  noExternal: [/(.*)/],
  external: [
    // Node built-ins (ioredis, postgres, bcryptjs use these)
    "events",
    "stream",
    "net",
    "tls",
    "dns",
    "fs",
    "path",
    "os",
    "crypto",
    "buffer",
    "util",
    "url",
    "http",
    "https",
    "zlib",
    "string_decoder",
    "querystring",
    "child_process",
    "assert",
    "constants",
    "node:*",
    // Native packages that can't be bundled
    "postgres",
    "bcryptjs",
    "ioredis",
  ],
  dts: false,
  sourcemap: true,
});
