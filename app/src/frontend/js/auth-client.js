/**
 * Auth client wrapper — provides simple functions for the auth drawer.
 * Uses the Better Auth client bundled from src/client-entry.js.
 * Adapted from feat/user-story-1-auth for use in the dev map drawer.
 */

const authClient = window.authClient

export async function emailSignIn(email, password) {
	return authClient.signIn.email({ email, password })
}

export async function emailSignUp(name, email, password) {
	return authClient.signUp.email({ name, email, password })
}

export async function googleSignIn() {
	return authClient.signIn.social({
		provider: 'google',
		callbackURL: '/',
		newUserCallbackURL: '/',
		errorCallbackURL: '/',
	})
}

export async function baSignOut() {
	return authClient.signOut()
}

/** Clear the express-session bridge cookie too. */
export async function clearBridgeSession() {
	await fetch('/api/auth-bridge/logout', {
		method: 'POST',
		credentials: 'include',
	})
}
