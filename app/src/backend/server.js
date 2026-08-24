import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'

import pool from './utils/db.js'
import { auth } from './auth-config.js'
import event_routes from './routes/events.js'
import auth_routes from './routes/auth.js'
import trivia_routes from './routes/trivia.js'
import card_routes from './routes/cards.js'
import { execute_sql_script } from './utils/sql_utils.js'

const app = express()
const PORT = process.env.PORT || 3000

const allowed_origins = ['http://localhost:8055', 'http://localhost:5173', 'http://127.0.0.1:5173']
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

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'a2a-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
)

// ── BODY PARSER ──
// MUST be before any route that reads req.body.
// Better-auth's toNodeHandler handles its own body parsing internally,
// so this does not interfere with OAuth/email routes.
app.use(express.json())

// ── CUSTOM AUTH ROUTES (username + PIN) ──
// Mounted BEFORE better-auth so our /login, /register, /me, /logout
// take precedence over the catch-all better-auth handler.
app.use('/api/auth', auth_routes)

// ── BETTER-AUTH HANDLER (Google OAuth) ──
// Unmatched paths (e.g. /callback/google) fall through to better-auth.
app.use('/api/auth', toNodeHandler(auth))

// ── SESSION RESOLUTION MIDDLEWARE ──
// Populates req.user from EITHER our custom session OR Better Auth's session.
app.use(async (req, res, next) => {
  // 1. Custom session (username + PIN)
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

  // 2. Better Auth session (Google OAuth)
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
      } else {
        // First-time Google user — sync into our users table
        const [result] = await pool.query(
          `INSERT INTO users (provider_id, email, name, avatar_url, points)
           VALUES (?, ?, ?, ?, 0)`,
          [`betterauth:${bSession.user.id}`, bSession.user.email, bSession.user.name, bSession.user.image]
        )
        const [newUsers] = await pool.query(
          'SELECT user_id, name, email, avatar_url, points FROM users WHERE user_id = ?',
          [result.insertId]
        )
        req.user = newUsers[0]
      }
    }
  } catch (err) {
    // Silently continue for unauthenticated requests
  }
  next()
})

app.use('/api/events', event_routes)
app.use('/api/trivia', trivia_routes)
app.use('/api/cards', card_routes)

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
  await initialize_database()
  if (process.env.SEED_DB === 'true') {
    await seed_database()
  }
  if (process.env.LOG_DB_INFO === 'true') {
    await view_database()
  }
} catch (err) {
  console.error('error: ', err.message)
}

app.listen(PORT, () => {
  console.log(`A2A backend running on port ${PORT}`)
})
