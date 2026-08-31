/**
 * Better Auth server configuration.
 * Adapted from feat/user-story-1-auth for integration into dev.
 *
 * Uses MySQL via mysql2, supports email/password + Google OAuth.
 */

import { betterAuth } from 'better-auth'
import { createPool } from 'mysql2/promise'

const dbPool = createPool({
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT || '3306', 10),
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'wits_quest',
	timezone: 'Z',
})

function buildSocialProviders() {
	const providers = {}
	if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
		providers.google = {
			clientId: process.env.GOOGLE_CLIENT_ID,
			clientSecret: process.env.GOOGLE_CLIENT_SECRET,
		}
	}
	return providers
}

const socialProviders = buildSocialProviders()

export const auth = betterAuth({
	database: dbPool,
	baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
	secret: process.env.BETTER_AUTH_SECRET,
	appName: 'Adamas2Aurum',
	trustedOrigins: [
		'http://localhost:8055',
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'http://localhost:3000',
		'http://127.0.0.1:3000',
	],
	socialProviders,
	emailAndPassword: {
		enabled: true,
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
	user: {
		deleteUser: { enabled: true },
	},
})
