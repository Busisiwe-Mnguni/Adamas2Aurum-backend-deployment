/**
 * Adamas2Aurum — Landing auth (Better Auth client)
 *
 * Handles tab toggle, Google + email/password sign-in/up, forgot
 * password. Uses Better Auth's client SDK (window.authClient). On
 * success the player is sent to the events page.
 */
const authClient = window.authClient
if (!authClient) console.error('[auth] authClient bundle not loaded')

// ---------------------------------------------------------------------------
// If already signed in, skip the landing straight to events
// ---------------------------------------------------------------------------
;(async function redirectIfAuthed() {
	if (!authClient) return
	try {
		const { data } = await authClient.getSession()
		if (data) window.location.href = '/events'
	} catch {
		/* not signed in — stay on the landing */
	}
})()

// ---------------------------------------------------------------------------
// Tab toggle (sign in / sign up)
// ---------------------------------------------------------------------------
const tabSignin = document.getElementById('tab-signin')
const tabSignup = document.getElementById('tab-signup')
const loginForm = document.getElementById('login-form')
const signupForm = document.getElementById('signup-form')

function showTab(tab) {
	const isSignin = tab === 'signin'
	tabSignin.classList.toggle('active', isSignin)
	tabSignup.classList.toggle('active', !isSignin)
	loginForm.classList.toggle('hidden', !isSignin)
	signupForm.classList.toggle('hidden', isSignin)
	document.getElementById('status').classList.add('hidden')
}
tabSignin?.addEventListener('click', () => showTab('signin'))
tabSignup?.addEventListener('click', () => showTab('signup'))

// ---------------------------------------------------------------------------
// Utility: show status message
// ---------------------------------------------------------------------------
function showStatus(message, isError) {
	const statusEl = document.getElementById('status')
	statusEl.className = isError ? 'status error' : 'status'
	statusEl.textContent = message
	statusEl.classList.remove('hidden')
}

function authError(error, fallback) {
	if (error?.message) return error.message
	if (error?.status) return `${fallback} (${error.status} ${error.statusText || ''})`
	return fallback + ' — could not reach server'
}

// ===========================================================================
// GOOGLE OAUTH
// ===========================================================================
window.handleGoogleSignUp = async function () {
	showStatus('Redirecting to Google…', false)
	const { error } = await authClient.signIn.social({
		provider: 'google',
		callbackURL: '/events',
		newUserCallbackURL: '/events',
		errorCallbackURL: '/',
	})
	if (error) showStatus(authError(error, 'Sign up failed'), true)
}

window.handleGoogleLogin = async function () {
	showStatus('Redirecting to Google…', false)
	const { error } = await authClient.signIn.social({
		provider: 'google',
		callbackURL: '/events',
		errorCallbackURL: '/',
	})
	if (error) showStatus(authError(error, 'Log in failed'), true)
}

// ===========================================================================
// EMAIL / PASSWORD
// ===========================================================================
window.handleEmailSignUp = async function (event) {
	event.preventDefault()
	const name = document.getElementById('signup-name').value.trim()
	const email = document.getElementById('signup-email').value.trim()
	const password = document.getElementById('signup-password').value

	showStatus('Creating account…', false)
	const { data, error } = await authClient.signUp.email({
		name,
		email,
		password,
		callbackURL: '/events',
	})

	if (error) {
		showStatus(authError(error, 'Sign up failed'), true)
	} else {
		showStatus('Account created! Redirecting…', false)
		window.location.href = '/events'
	}
}

window.handleEmailLogin = async function (event) {
	event.preventDefault()
	const email = document.getElementById('login-email').value.trim()
	const password = document.getElementById('login-password').value

	showStatus('Signing in…', false)
	const { data, error } = await authClient.signIn.email({
		email,
		password,
		callbackURL: '/events',
	})

	if (error) {
		showStatus(authError(error, 'Log in failed'), true)
	} else {
		showStatus('Signed in! Redirecting…', false)
		window.location.href = '/events'
	}
}

// ===========================================================================
// FORGOT PASSWORD
// ===========================================================================
window.handleForgotPassword = async function (event) {
	event.preventDefault()
	const email = prompt(
		'Enter your email address to receive a password reset link:'
	)
	if (!email) return

	showStatus('Sending reset link…', false)
	const { error } = await authClient.requestPasswordReset({
		email,
		redirectTo:
			window.location.origin + '/pages/reset-password.html',
	})

	if (error) {
		showStatus(authError(error, 'Reset request failed'), true)
	} else {
		showStatus(
			'If an account exists with that email, a reset link has been sent. ' +
				'Check the server console for the reset URL.',
			false
		)
	}
}
