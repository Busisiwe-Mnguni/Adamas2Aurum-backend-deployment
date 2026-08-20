import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import mySQLSession from 'express-mysql-session'
import cors from 'cors'

import pool from './utils/db.js'
import event_routes from './routes/events.js'
import card_routes from './routes/cards.js'
import battle_routes from './routes/battle.js'
import auth_routes from './routes/auth.js'
import { execute_sql_script } from './utils/sql_utils.js'

const app = express()
const PORT = process.env.PORT || 3000

//CORS
const allowed_origins = ['http://localhost:8055']
app.use(express.json())
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
app.use(
	session({
		key: 'a2a-session-key',
		secret: process.env.SESSION_SECRET || 'a2a-dev-secret',
		store: sessionStore,
		resave: false,
		saveUninitialized: false,
		cookie: {
			httpOnly: true,
			secure: false, // set true in production with HTTPS
			maxAge: 1000 * 60 * 60 * 24, // 8 hours
		},
	})
)

app.use((req, res, next) => {
	req.user = req.session.user || null
	next()
})

app.use('/api/auth', auth_routes)
app.use('/api/events', event_routes)
app.use('/api/cards', card_routes)
app.use('/api/battles', battle_routes)

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
}

async function seed_database() {
	await execute_sql_script(pool, './db/seed.sql')
}

async function view_database() {
	console.log(await pool.query('SELECT NOW() as currentTime;'))
	console.log(await pool.query('SHOW DATABASES;'))
	console.log(await pool.query('SHOW TABLES FROM a2adb;'))
}

try {
	//await initialize_database()
	//await seed_database()
	await view_database()
} catch (err) {
	console.error('error: ', err.message)
}

app.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
})
