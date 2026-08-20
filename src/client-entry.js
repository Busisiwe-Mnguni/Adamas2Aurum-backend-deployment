/**
 * Client-side entry point for esbuild bundling.
 * Creates and exports the Better Auth client for use in the browser.
 */
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
  baseURL: window.location.origin,
});

// Expose on window for vanilla JS usage
window.authClient = authClient;

// Also export for ESM consumers
export default authClient;
