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
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'

import pool from './utils/db.js'
import { auth } from './src/auth.js'
import event_routes from './routes/events.js'
import auth_routes from './routes/auth.js'
import trivia_routes from './routes/trivia.js'
import { execute_sql_script } from './utils/sql_utils.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

// ---------------------------------------------------------------------------
// CORS — includes frontend dev origins AND localhost:3000 for same-origin
// serving (the backend now serves the frontend from port 3000).
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// express-session — kept for the team's existing routes (trivia, events)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Better Auth handler — MUST be mounted BEFORE express.json()
// Catches all requests to /api/auth/* (sign-in, sign-up, session, etc.)
// Uses Express 5 wildcard syntax: {*path}
// ---------------------------------------------------------------------------
app.all('/api/auth/{*path}', toNodeHandler(auth))

app.use(express.json())

// ---------------------------------------------------------------------------
// Existing API routes (unchanged)
// ---------------------------------------------------------------------------
app.use('/api/auth', auth_routes)
app.use('/api/events', event_routes)
app.use('/api/trivia', trivia_routes)

app.get('/api/health', async (req, res) => {
  try {
    const [rows] = await pool.query('SHOW TABLES')
    res.json({ success: true, tables: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ---------------------------------------------------------------------------
// Bridge middleware — on every request, check for a Better Auth session and
// populate req.session.user so that existing routes (trivia, events) that
// read req.session.user.user_id keep working without modification.
// ---------------------------------------------------------------------------
app.use(async (req, res, next) => {
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
          [providerId, baUser.email, baUser.name || baUser.email.split('@')[0]]
        )
        rows = [{
          user_id: result.insertId,
          name: baUser.name || baUser.email.split('@')[0],
          email: baUser.email,
        }]
      }

      req.session.user = {
        user_id: rows[0].user_id,
        name: rows[0].name,
        email: rows[0].email,
      }
    }
  } catch (err) {
    // Bridge failure must never block the request — treat as unauthenticated
    console.error('Bridge middleware error:', err.message)
  }
  next()
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
// ---------------------------------------------------------------------------
app.get('/api/me', async (req, res) => {
  if (!req.session?.user?.user_id) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  res.json(req.session.user)
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

// ---------------------------------------------------------------------------
// Database initialization (unchanged from dev)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Better Auth auto-creates its tables (user, session, account, verification)
// when it first handles a request. No manual migration needed.
// ---------------------------------------------------------------------------

app.listen(PORT, () => {
  console.log(`A2A backend running on port ${PORT}`)
  console.log(`Open: http://localhost:${PORT}`)
})
