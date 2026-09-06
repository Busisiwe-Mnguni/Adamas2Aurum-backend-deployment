/**
 * Adamas2Aurum — Express Server (dev branch)
 *
 * Integrates Better Auth (from feat/user-story-1-auth) with the existing
 * team infrastructure. A bridge middleware maps Better Auth sessions to
 * express-session so that existing routes (events, trivia, sync) keep working
 * without modification.
 *
 * All existing functionality preserved:
 *   - event_routes, trivia_routes, sync_routes, auth_routes (PIN-based, kept for compat)
 *   - initialize_database (schema.sql with CREATE TABLE IF NOT EXISTS)
 *   - seed_database (only when SEED_DB=true)
 *   - /api/health endpoint
 */

import express from 'express'
import session from 'express-session'
import mySQLSession from 'express-mysql-session'
import cors from 'cors'
import { createServer } from 'http'

import path from 'path'
import { fileURLToPath } from 'url'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'

import event_routes from './routes/events.js'
import card_routes from './routes/cards.js'
import battle_routes from './routes/battle.js'
import auth_routes from './routes/auth.js'
import trivia_routes from './routes/trivia.js'
import question_routes from './routes/questions.js'
import sync_routes from './routes/sync.js'

import pool from './utils/db.js'
import { auth } from './src/auth.js'
import { execute_sql_script } from './utils/sql_utils.js'
import { setup_websocket_router } from './websocket/socket_router.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

var allowed_origins
if (process.env.FRONTEND_URL) {
	allowed_origins = [process.env.FRONTEND_URL]
} else {
	allowed_origins = [
		'http://localhost:8055',
		'http://localhost:5173',
		'http://127.0.0.1:5173',
		'http://localhost:3000',
		'http://127.0.0.1:3000',
	]
}

app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin || allowed_origins.includes(origin)) {
				callback(null, true)
			} else {
				callback(new Error('Not allowed by CORS'))
			}
		},
		credentials: true,
	})
)

const MySQLStore = mySQLSession(session)
const sessionStore = new MySQLStore(
	{
		clearExpired: true,
		checkExpirationInterval: 900000, // 15 mins
		expiration: 86400000, // 24 hrs
	},
	pool
)

const session_middleware = session({
	key: 'a2a-session-key',
	secret: process.env.SESSION_SECRET || 'a2a-dev-secret',
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		secure: false,
		maxAge: 1000 * 60 * 60 * 24, // 24 hours
	},
})

// CONFLICT RESOLUTION NOTE: session_middleware must actually be applied via
// app.use() — it's referenced later by setup_websocket_router(server,
// session_middleware), and without this the websocket router would receive
// a session middleware that was never wired into the request pipeline.
app.use(session_middleware)

// Map default req.user from express-session if present
app.use((req, res, next) => {
	req.user = req.session?.user || null
	next()
})

const PIN_AUTH_PATHS = ['/login', '/register', '/logout', '/me']

// Better Auth endpoint passthrough
app.use('/api/auth', (req, res, next) => {
	if (PIN_AUTH_PATHS.includes(req.path)) {
		return next() // skip Better Auth → falls through to auth_routes below
	}
	toNodeHandler(auth)(req, res, next)
})

app.use('/api/auth', auth_routes)

// ---------------------------------------------------------------------------
// BRIDGE MIDDLEWARE & SESSION RESOLUTION
// Resolves session from EITHER PIN auth OR Better Auth (Google OAuth)
// BEFORE downstream route processing. Populates both req.user and req.session.user.
// ---------------------------------------------------------------------------
app.use(async (req, res, next) => {
	// 1. Custom session (username + PIN)
	if (req.session?.user?.user_id) {
		try {
			const [users] = await pool.query(
				'SELECT user_id, name, email, avatar_url, points FROM users WHERE user_id = ?',
				[req.session.user.user_id]
			)
			if (users.length) {
				req.user = users[0]
				req.session.user = {
					user_id: users[0].user_id,
					name: users[0].name,
					email: users[0].email,
				}
			}
		} catch (err) {
			console.warn(
				'Custom session resolve error:',
				err.message
			)
		}
		return next()
	}

	// 2. Better Auth session (Google OAuth)
	// CONFLICT RESOLUTION NOTE: matches by provider_id OR email (rather than
	// email alone) so a returning Google-auth user is correctly recognised
	// even if their provider_id was set on a prior visit — avoids creating
	// duplicate user rows for the same person.
	try {
		const baSession = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		})

		if (baSession?.user) {
			const baUser = baSession.user
			const providerId = `better-auth:${baUser.id}`

			let [rows] = await pool.query(
				'SELECT user_id, name, email, avatar_url, points FROM users WHERE provider_id = ? OR email = ?',
				[providerId, baUser.email]
			)

			if (!rows.length) {
				// First-time Google user — sync into our users table
				const [result] = await pool.query(
					`INSERT INTO users (provider_id, email, name, avatar_url, points)
                     VALUES (?, ?, ?, ?, 0)`,
					[
						providerId,
						baUser.email,
						baUser.name ||
							baUser.email.split(
								'@'
							)[0],
						baUser.image,
					]
				)
				const [newUsers] = await pool.query(
					'SELECT user_id, name, email, avatar_url, points FROM users WHERE user_id = ?',
					[result.insertId]
				)
				rows = newUsers
			}

			req.user = rows[0]
			req.session.user = {
				user_id: rows[0].user_id,
				name: rows[0].name,
				email: rows[0].email,
			}
		}
	} catch (err) {
		// Bridge failure must never block the request — treat as unauthenticated
		console.warn(
			'Bridge middleware session resolve error:',
			err.message
		)
	}
	next()
})

// ---------------------------------------------------------------------------
// ROUTE MOUNTS
// CONFLICT RESOLUTION NOTE: both question_routes (US6, existing) and
// sync_routes (offline sync, this PR) are needed — they're unrelated
// features that both got added independently, not alternatives to each
// other.
// ---------------------------------------------------------------------------
app.use('/api/events', event_routes)
app.use('/api/cards', card_routes)
app.use('/api/battles', battle_routes)
app.use('/api/trivia', trivia_routes)
app.use('/api/sync', sync_routes)

// Question authoring. Mounted at /api so the single router
// can serve both /api/events/:eventId/questions and /api/questions/:id.
app.use('/api', question_routes)

app.get('/api/health', async (req, res) => {
	try {
		const [rows] = await pool.query('SHOW TABLES')
		res.json({ success: true, tables: rows })
	} catch (error) {
		res.status(500).json({ success: false, error: error.message })
	}
})

// ---------------------------------------------------------------------------
// Bridge logout — destroys the express-session cookie
// ---------------------------------------------------------------------------
app.post('/api/auth-bridge/logout', (req, res) => {
	req.session.destroy(() => {
		res.clearCookie('connect.sid')
		res.json({ message: 'Bridge session cleared' })
	})
})

// ---------------------------------------------------------------------------
// Get current authenticated user (used by frontend checkAuthSession)
//
// CONFLICT RESOLUTION NOTE: neither original side was quite right alone —
// req.user is populated by the bridge middleware above for BOTH PIN and
// Better Auth sessions, while req.session.user is only guaranteed for PIN
// sessions. Checking both (matching the same pattern already used by
// requireAuth() in routes/trivia.js and routes/sync.js) covers either path.
// ---------------------------------------------------------------------------
app.get('/api/me', async (req, res) => {
	const userId = req.session?.user?.user_id || req.user?.user_id
	if (!userId) {
		return res.status(401).json({ error: 'Not authenticated' })
	}
	res.json(req.user || req.session.user)
})

// ---------------------------------------------------------------------------
// Static file serving — backend serves the frontend so everything runs
// from the same origin (port 3000), eliminating cross-origin cookie issues.
// ---------------------------------------------------------------------------
const frontendDir = path.join(__dirname, '..', 'frontend')
const pagesDir = path.join(frontendDir, 'pages')

app.use('/css', express.static(path.join(frontendDir, 'css')))
app.use('/js', express.static(path.join(frontendDir, 'js')))
app.use(express.static(path.join(frontendDir, 'public')))

// Main map page
app.get('/', (_req, res) => {
	res.sendFile(path.join(frontendDir, 'index.html'))
})

// Other HTML pages
app.get('/pages/auth.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'auth.html'))
})
app.get('/pages/collection.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'collection.html'))
})
app.get('/pages/console.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'console.html'))
})
app.get('/pages/events.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'events.html'))
})
app.get('/pages/map.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'map.html'))
})
// CONFLICT RESOLUTION NOTE / BUG FIX: this route was serving map.html
// instead of battle.html (looked like a copy-paste error from the route
// above it during the merge). Fixed to point at the correct file.
app.get('/pages/battle.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'battle.html'))
})

// ---------------------------------------------------------------------------
// Database initialization (unchanged from dev)
// ---------------------------------------------------------------------------
async function initialize_database() {
	// Creates tables if they don't exist yet — safe to run every startup,
	// since schema.sql uses CREATE TABLE IF NOT EXISTS and doesn't touch data.
	await execute_sql_script(pool, './db/schema.sql')
}

async function seed_database() {
	// Destructive: TRUNCATEs and re-inserts all seed data. Must NOT run
	// automatically on startup. Run explicitly instead: `npm run db:seed`
	await execute_sql_script(pool, './db/seed.sql')
}

async function clear_database() {
	await execute_sql_script(pool, './db/clear_db.sql')
}

async function view_database() {
	console.log(await pool.query('SELECT NOW() as currentTime;'))
	console.log(await pool.query('SHOW DATABASES;'))
	console.log(
		await pool.query(
			`SHOW TABLES FROM ${process.env.DB_NAME || 'testdb'};`
		)
	)
}

try {
	await initialize_database()

	if (process.env.CLEAR_DB === 'true') {
		await clear_database()
	}
	if (process.env.SEED_DB === 'true') {
		await seed_database()
	}
	if (process.env.LOG_DB === 'true') {
		await view_database()
	}
} catch (err) {
	console.error('error: ', err.message)
}

const server = createServer(app)
setup_websocket_router(server, session_middleware)

server.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
	console.log(`Open: http://localhost:${PORT}`)
})
