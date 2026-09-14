/**
 * Auth client wrapper — provides simple functions for the auth drawer.
 *
 * The custom PIN/session routes in /api/auth are used for username + PIN
 * login. Better Auth is used only for Google OAuth, which we trigger with a
 * plain redirect so we don't need the heavier Better Auth client bundle.
 */
import { API_BASE } from "./constants.js";

const AUTH_API = `${API_BASE}/api/auth`;

export async function usernameSignIn(username, pin) {
    try {
        const res = await fetch(`${AUTH_API}/login`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: username, pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Login failed");
        return { data: data.user, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function usernameSignUp(name, username, pin) {
    try {
        const res = await fetch(`${AUTH_API}/register`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email: username, pin }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed");
        return { data: data.user, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

export async function googleSignIn() {
    const callbackURL = window.location.pathname + window.location.search;
    const params = new URLSearchParams({
        provider: "google",
        callbackURL,
        errorCallbackURL: callbackURL,
        newUserCallbackURL: callbackURL,
    });
    window.location.href = `${AUTH_API}/signin/social?${params.toString()}`;
    // The page navigates away; return a never-settling promise so callers
    // don't crash before the redirect completes.
    return new Promise(() => {});
}

export async function baSignOut() {
    try {
        await fetch(`${AUTH_API}/signout`, {
            method: "POST",
            credentials: "include",
        });
    } catch (err) {
        console.warn("Better Auth signout failed:", err);
    }
}

/** Clear the express-session cookie too. */
export async function clearBridgeSession() {
    await fetch(`${AUTH_API}/logout`, {
        method: "POST",
        credentials: "include",
    });
}
