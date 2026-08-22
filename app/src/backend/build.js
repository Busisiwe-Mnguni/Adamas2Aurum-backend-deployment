/**
 * Build script — bundles the Better Auth browser client into a single
 * ESM file using esbuild. Run before starting the server.
 *
 * Usage: node build.js
 */
import { build } from "esbuild";

await build({
  entryPoints: ["src/client-entry.js"],
  bundle: true,
  format: "esm",
  outfile: "../frontend/public/js/auth-client.bundle.mjs",
  platform: "browser",
  target: "es2020",
  minify: false, // Keep readable for university project
  sourcemap: true,
});

console.log("Client bundle built: ../frontend/public/js/auth-client.bundle.mjs");
