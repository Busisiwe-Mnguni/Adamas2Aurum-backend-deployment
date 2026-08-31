/**
 * Adamas2Aurum — Express Server (dev branch)
 *
 * Integrates Better Auth (from feat/user-story-1-auth) with the existing
 * team infrastructure. A bridge middleware maps Better Auth sessions to
 * express-session so that existing routes (events, trivia) keep working
 * without modification.
 *
 * All existing functionality preserved:
 *   - event_routes, trivia_routes, auth_routes (PIN-based, kept for compat)
 *   - initialize_database (schema.sql with CREATE TABLE IF NOT EXISTS)
 *   - seed_database (only when SEED_DB=true)
 *   - /api/health endpoint
 */

import './env.js'
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

import pool from './utils/db.js'
import { auth } from './src/auth.js'
import { execute_sql_script } from './utils/sql_utils.js'
import { setup_websocket_router } from './websocket/socket_router.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())
const allowed_origins = [
	'http://localhost:8055',
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'http://localhost:3000',
	'http://127.0.0.1:3000',
]
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
app.use(session_middleware)
app.use((req, res, next) => {
	req.user = req.session?.user || null
	next()
})

app.use(express.json())

const PIN_AUTH_PATHS = ['/login', '/register', '/logout', '/me']

app.use('/api/auth', (req, res, next) => {
	if (PIN_AUTH_PATHS.includes(req.path)) {
		return next() // skip Better Auth → falls through to auth_routes below
	}
	toNodeHandler(auth)(req, res, next)
})

app.use('/api/auth', auth_routes)

// ---------------------------------------------------------------------------
// Bridge middleware — runs BEFORE all routes so that every request that
// carries a Better Auth session cookie gets req.session.user populated.
// This allows existing routes (events, trivia, /api/me) that read
// req.session.user.user_id to work for Google OAuth users without modification.
// ---------------------------------------------------------------------------
app.use(async (req, res, next) => {
	// Skip if express-session already has a valid user (PIN login path)
	if (req.session?.user?.user_id) return next()

	try {
		const baSession = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		})

		if (baSession?.user) {
			const baUser = baSession.user
			const providerId = `better-auth:${baUser.id}`

			// Look up or create a row in the team's users table
			let [rows] = await pool.query(
				'SELECT user_id, name, email FROM users WHERE provider_id = ?',
				[providerId]
			)

			if (!rows.length) {
				const [result] = await pool.query(
					'INSERT INTO users (provider_id, email, name, points) VALUES (?, ?, ?, 0)',
					[
						providerId,
						baUser.email,
						baUser.name || baUser.email.split('@')[0],
					]
				)
				rows = [
					{
						user_id: result.insertId,
						name: baUser.name || baUser.email.split('@')[0],
						email: baUser.email,
					},
				]
			}

			req.session.user = {
				user_id: rows[0].user_id,
				name: rows[0].name,
				email: rows[0].email,
			}
		}
	} catch (err) {
		// Bridge failure must never block the request — treat as unauthenticated
		console.error(`[Bridge] Error on ${req.method} ${req.originalUrl}:`, err.message)
	}
	next()
})

// ── SESSION RESOLUTION MIDDLEWARE ──
// Populates req.user from EITHER our custom session OR Better Auth's session.
app.use(async (req, res, next) => {
  // 1. Custom session (username + PIN) or bridge-populated Google session
  if (req.session?.user?.user_id) {
    try {
      const [users] = await pool.query(
        'SELECT user_id, name, email, avatar_url, points FROM users WHERE user_id = ?',
        [req.session.user.user_id]
      )
      if (users.length) req.user = users[0]
    } catch (err) {
      console.warn('Custom session resolve error:', err.message)
    }
    return next()
  }

  // 2. Fallback: read Better Auth session directly into req.user (no express-session write)
  try {
    const bSession = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })
    if (bSession?.user) {
      const [users] = await pool.query(
        'SELECT user_id, name, email, avatar_url, points FROM users WHERE email = ?',
        [bSession.user.email]
      )
      if (users.length) {
        req.user = users[0]
      }
    }
  } catch (err) {
    // Silently continue for unauthenticated requests
  }
  next()
})

app.use('/api/events', event_routes)
app.use('/api/cards', card_routes)
app.use('/api/battles', battle_routes)
app.use('/api/trivia', trivia_routes)
app.use('/api/cards', card_routes)
// User Story 6 — question authoring. Mounted at /api so the single
// router can serve both /api/events/:eventId/questions and /api/questions/:id.
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
// Get current authenticated user (used by frontend checkAuthSession).
// Accepts either express-session (PIN login) or req.user (Google OAuth).
// ---------------------------------------------------------------------------
app.get('/api/me', async (req, res) => {
	const user = req.session?.user?.user_id ? req.session.user : req.user
	if (!user?.user_id) {
		return res.status(401).json({ error: 'Not authenticated' })
	}
	// Fetch roles for the user
	try {
		const [rows] = await pool.query(
			'SELECT role FROM admin_roles WHERE user_id = ?',
			[user.user_id]
		)
		res.json({ ...user, roles: rows.map((r) => r.role) })
	} catch (err) {
		res.json({ ...user, roles: [] })
	}
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
app.get('/pages/console.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'console.html'))
})
app.get('/pages/events.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'events.html'))
})
app.get('/pages/map.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'map.html'))
})
app.get('/pages/battle.html', (_req, res) => {
	res.sendFile(path.join(pagesDir, 'map.html'))
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
	// Destructive: TRUNCATEs and re-inserts all seed data. This must NOT run
	// automatically on every `npm run dev`, since the DB is shared across the
	// whole team — one teammate starting their backend would silently wipe
	// out data another teammate is actively testing against (this is what
	// caused login to intermittently fail with "Invalid credentials" even
	// though the seeded PIN was correct).
	//
	// Run explicitly instead: `npm run db:seed`
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
	// console.log(await pool.query('DESCRIBE ${process.env.DB_NAME || 'testdb'}.battle_turns;'))
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

// Warn at startup if Better Auth required env vars are missing
if (!process.env.BETTER_AUTH_SECRET) {
	console.warn(
		'[Auth] WARNING: BETTER_AUTH_SECRET is not set. ' +
		'Better Auth features (Google OAuth, Better Auth sessions) will fail. ' +
		'Set it in app/src/backend/.env'
	)
}

const server = createServer(app)
setup_websocket_router(server, session_middleware)

server.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
	console.log(`Open: http://localhost:${PORT}`)
})
