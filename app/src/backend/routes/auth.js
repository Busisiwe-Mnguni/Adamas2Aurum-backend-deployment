import express from 'express'
import crypto from 'crypto'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../auth-config.js'
import pool from '../utils/db.js'

const router = express.Router()

function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex').toLowerCase()
}

router.use((req, res, next) => {
  console.log(
    `[Auth Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
  )
  next()
})

/**
 * POST /api/auth/register
 * Username + PIN registration (no email required from user).
 */
router.post('/register', async (req, res) => {
  const { name, username, pin } = req.body

  if (!name || !username || !pin) {
    return res.status(400).json({ error: 'Name, username, and PIN are required' })
  }

  const cleanName = name.trim()
  const cleanUser = username.trim().toLowerCase()
  const provider_id = `local:${cleanUser}`
  const synthetic_email = `${cleanUser}@local`

  try {
    const [existing] = await pool.query(
      'SELECT user_id FROM users WHERE provider_id = ? OR email = ?',
      [provider_id, synthetic_email]
    )

    if (existing.length > 0) {
      return res.status(400).json({ error: 'Username already taken' })
    }

    const [result] = await pool.query(
      'INSERT INTO users (provider_id, email, name, points) VALUES (?, ?, ?, 0)',
      [provider_id, synthetic_email, cleanName]
    )

    const userId = result.insertId
    await pool.query(
      'INSERT INTO user_credentials (user_id, pin_hash) VALUES (?, ?)',
      [userId, hashPin(pin)]
    )

    req.session.user = {
      user_id: userId,
      name: cleanName,
      email: synthetic_email,
    }

    res.status(201).json({ message: 'Account created', user: req.session.user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/auth/login
 * Username + PIN login.
 */
router.post('/login', async (req, res) => {
  const { username, pin } = req.body
  const cleanUser = username ? username.trim().toLowerCase() : ''

  if (!cleanUser || !pin) {
    return res.status(400).json({ error: 'Username and PIN are required' })
  }

  try {
    const [users] = await pool.query(
      'SELECT user_id, name, email FROM users WHERE provider_id = ?',
      [`local:${cleanUser}`]
    )

    if (!users.length) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const user = users[0]

    const [creds] = await pool.query(
      'SELECT pin_hash FROM user_credentials WHERE user_id = ?',
      [user.user_id]
    )

    if (!creds.length || creds[0].pin_hash.toLowerCase() !== hashPin(pin)) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    req.session.user = {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
    }

    res.json({ message: 'Logged in', user: req.session.user })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/auth/me
 * Returns current user for BOTH custom sessions and Better Auth (Google) sessions.
 */
router.get('/me', async (req, res) => {
  // 1. Custom session (username + PIN)
  if (req.session?.user?.user_id) {
    try {
      const [users] = await pool.query(
        'SELECT user_id, name, email, avatar_url, points FROM users WHERE user_id = ?',
        [req.session.user.user_id]
      )
      if (!users.length) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      const user = users[0]
      const [roles] = await pool.query(
        'SELECT role FROM admin_roles WHERE user_id = ?',
        [user.user_id]
      )
      return res.json({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        points: user.points,
        roles: roles.map((r) => r.role),
      })
    } catch (err) {
      return res.status(500).json({ error: err.message })
    }
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
      if (!users.length) {
        return res.status(401).json({ error: 'Not authenticated' })
      }
      const user = users[0]
      const [roles] = await pool.query(
        'SELECT role FROM admin_roles WHERE user_id = ?',
        [user.user_id]
      )
      return res.json({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        avatar_url: user.avatar_url,
        points: user.points,
        roles: roles.map((r) => r.role),
      })
    }
  } catch (err) {
    // ignore
  }

  return res.status(401).json({ error: 'Not authenticated' })
})

/**
 * POST /api/auth/logout
 * Clears BOTH custom session and Better Auth session.
 */
router.post('/logout', async (req, res) => {
  // Destroy custom session
  req.session.destroy(() => {})

  // Sign out from Better Auth
  try {
    await auth.api.signOut({ headers: fromNodeHeaders(req.headers) })
  } catch (err) {
    // ignore
  }

  res.clearCookie('connect.sid')
  res.json({ message: 'Logged out' })
})

export default router