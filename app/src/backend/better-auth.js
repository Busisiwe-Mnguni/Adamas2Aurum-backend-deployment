/**
 * Adamas2Aurum - Better Auth Server Configuration
 *
 * Configures Better Auth with:
 *   - MySQL database (via mysql2)
 *   - Google OAuth provider
 *   - Email/Password authentication
 *   - Password reset (reset URL logged to console)
 *   - Account deletion
 *
 * Plain JavaScript (ESM). No TypeScript. No frameworks.
 */

import { betterAuth } from 'better-auth'
import { createPool } from 'mysql2/promise'

// ---------------------------------------------------------------------------
// MySQL connection pool
// ---------------------------------------------------------------------------
const dbPool = createPool({
	host: process.env.DB_HOST || '127.0.0.1',
	port: parseInt(process.env.DB_PORT || '3306', 10),
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'a2adb',
	timezone: 'Z', // Required by Better Auth for consistent timestamps
	ssl:
		process.env.DB_SSL === 'true'
			? { rejectUnauthorized: false }
			: undefined,
})

// ---------------------------------------------------------------------------
// Social providers configuration
// ---------------------------------------------------------------------------
function buildSocialProviders() {
	const providers = {}

	// Google OAuth — works on localhost for development
	if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
		providers.google = {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}
	}

	return providers
}

// ---------------------------------------------------------------------------
// Better Auth instance
// ---------------------------------------------------------------------------
const socialProviders = buildSocialProviders()

export const auth = betterAuth({
	database: dbPool,

	baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
	secret: process.env.BETTER_AUTH_SECRET,

	appName: 'Adamas2Aurum',

	socialProviders,

	// Email/Password authentication (handled entirely by Better Auth)
	emailAndPassword: {
		enabled: true,
		// Password reset: logs the reset URL to the server console.
		// In production, replace this with a real email service (SMTP, etc.)
		sendResetPassword: async ({ user, url, token }) => {
			console.log(
				'\n========================================'
			)
			console.log('  PASSWORD RESET REQUEST')
			console.log('  User:  ' + user.email)
			console.log('  Token: ' + token)
			console.log('  URL:   ' + url)
			console.log(
				'========================================\n'
			)
		},
	},

	// Account deletion (handled entirely by Better Auth)
	user: {
		deleteUser: {
			enabled: true,
		},
	},
})
