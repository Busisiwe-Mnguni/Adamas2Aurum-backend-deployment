import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'

import pool from './utils/db.js'
import { auth } from './better-auth.js'
import event_routes from './routes/events.js'
import participation_routes from './routes/participation.js'
import { execute_sql_script } from './utils/sql_utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3000

//CORS — allows the separately-served frontend too, when used
app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin || origin.startsWith('http://localhost')) {
				callback(null, true)
			} else {
				callback(new Error('Not allowed by CORS'))
			}
		},
		credentials: true,
	})
)

//1. Better Auth handler — MUST be mounted BEFORE express.json()
app.all('/api/auth/*splat', toNodeHandler(auth))

//2. JSON body parser (after Better Auth handler)
app.use(express.json())

//Landing → split map + Better Auth sign-in page (before static so
//express.static doesn't intercept '/' with index.html)
app.get('/', (_req, res) => {
	res.sendFile(
		path.join(__dirname, '../frontend', 'pages', 'sign-in.html')
	)
})

app.get('/events', (_req, res) => {
	res.sendFile(
		path.join(__dirname, '../frontend', 'pages', 'events.html')
	)
})

//3. Static frontend so /css, /js, /pages resolve same-origin
app.use(express.static(path.join(__dirname, '../frontend')))

//4. Session bridge — resolve the Better Auth session to a game
//   `users` row (creating one on first login) so the existing
//   events/participation routes can read req.user.user_id unchanged.
app.use(async (req, res, next) => {
	try {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		})
		if (session?.user) {
			const ba = session.user
			const [rows] = await pool.query(
				'SELECT user_id, name, email FROM users WHERE email = ? LIMIT 1',
				[ba.email]
			)
			if (rows.length) {
				req.user = rows[0]
			} else {
				const [r] = await pool.query(
					'INSERT INTO users (provider_id, email, name, avatar_url, points) VALUES (?, ?, ?, ?, 0)',
					[
						ba.id,
						ba.email,
						ba.name || 'Player',
						ba.image || null,
					]
				)
				req.user = {
					user_id: r.insertId,
					name: ba.name || 'Player',
					email: ba.email,
				}
			}
		} else {
			req.user = null
		}
	} catch {
		req.user = null
	}
	next()
})

app.use('/api/events', event_routes)
app.use('/api/events', participation_routes)

//Current user (bridged) — replaces the PIN /api/auth/me
app.get('/api/me', async (req, res) => {
	if (!req.user?.user_id) {
		return res.status(401).json({ error: 'Not authenticated' })
	}
	try {
		const [rows] = await pool.query(
			'SELECT role FROM admin_roles WHERE user_id = ?',
			[req.user.user_id]
		)
		res.json({
			user_id: req.user.user_id,
			name: req.user.name,
			email: req.user.email,
			roles: rows.map((r) => r.role),
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

app.get('/api/health', async (req, res) => {
	try {
		const [rows] = await pool.query('SHOW TABLES')
		res.json({ success: true, tables: rows })
	} catch (error) {
		res.status(500).json({ success: false, error: error.message })
	}
})

async function initialize_database() {
	await execute_sql_script(pool, './db/schema.sql')
	await execute_sql_script(pool, './db/better-auth-schema.sql')
}

async function seed_database() {
	await execute_sql_script(pool, './db/seed.sql')
}

try {
	await initialize_database()
	await seed_database()
} catch (err) {
	console.error('error: ', err.message)
}

app.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
})
