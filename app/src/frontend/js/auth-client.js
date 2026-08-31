/**
 * Auth client wrapper — provides simple functions for the auth drawer.
 * Uses the Better Auth client bundled from src/client-entry.js.
 * Adapted from feat/user-story-1-auth for use in the dev map drawer.
 */
import {API_BASE} from './constants.js'

const AUTH_API = `${API_BASE}/api/auth`

export async function emailSignIn(email, password) {
	try {
		const res = await fetch(`${AUTH_API}/login`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password }),
		})
		const data = await res.json()
		if (!res.ok) throw new Error(data.error || 'Login failed')
		return { data: data.user, error: null }
	} catch (error) {
		return { data: null, error }
	}
}

export async function emailSignUp(name, email, password) {
	try {
		const res = await fetch(`${AUTH_API}/register`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, email, password }),
		})
		const data = await res.json()
		if (!res.ok) throw new Error(data.error || 'Registration failed')
		return { data: data.user, error: null }
	} catch (error) {
		return { data: null, error }
	}
}

export async function googleSignIn() {
	try {
		const authClient = window.authClient
		if (!authClient) {
			throw new Error('Auth client not loaded — bundle missing or not yet executed')
		}
		return await authClient.signIn.social({
			provider: 'google',
			callbackURL: '/',
			newUserCallbackURL: '/',
			errorCallbackURL: '/',
		})
	} catch (error) {
		return { error }
	}
}

export async function baSignOut() {
	try {
		const authClient = window.authClient
		if (authClient) return authClient.signOut()
	} catch {
		// ignore
	}
}

/** Clear the express-session bridge cookie too. */
export async function clearBridgeSession() {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
}
