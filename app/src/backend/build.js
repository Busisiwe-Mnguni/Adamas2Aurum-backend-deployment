/**
 * Build script — bundles the Better Auth browser client into a single
 * ESM file using esbuild. Run before starting the server.
 * Adapted from feat/user-story-1-auth.
 */
import { build } from "esbuild";

await build({
    entryPoints: ["src/client-entry.js"],
    bundle: true,
    format: "esm",
    outfile: "../frontend/public/js/auth-client.bundle.mjs",
    platform: "browser",
    target: "es2020",
    minify: false,
    sourcemap: true,
});

console.log(
    "Client bundle built: ../frontend/public/js/auth-client.bundle.mjs",
);
