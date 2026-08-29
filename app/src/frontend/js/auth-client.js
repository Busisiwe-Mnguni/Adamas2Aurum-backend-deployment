/**
 * Auth client wrapper — provides simple functions for the auth drawer.
 * Uses the Better Auth client bundled from src/client-entry.js.
 * Adapted from feat/user-story-1-auth for use in the dev map drawer.
 */
import {API_BASE} from './constants.js'

const AUTH_API = `${API_BASE}/api/auth`
const authClient = window.authClient

export async function emailSignIn(email, password) {
	const res = await fetch(`${AUTH_API}/login`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	})
	const data = await res.json()
	if (!res.ok) throw new Error(data.error || 'Login failed')
	return data.user
}

export async function emailSignUp(name, email, password) {
	const res = await fetch(`${AUTH_API}/register`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, email, password }),
	})
	const data = await res.json()
	if (!res.ok) throw new Error(data.error || 'Login failed')
	return data.user
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
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
}
