/**
 * Client-side entry point for esbuild bundling.
 * Creates the Better Auth client for use in the browser.
 * Adapted from feat/user-story-1-auth.
 */
import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient({
    baseURL: window.location.origin,
});

window.authClient = authClient;
export default authClient;
