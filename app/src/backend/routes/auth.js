import express from 'express'
import crypto from 'crypto'
import pool from '../utils/db.js'

const router = express.Router()

function hashPin(pin) {
	return crypto.createHash('sha256').update(String(pin)).digest('hex')
}

router.post('/register', async (req, res) => {
	const { name, email, pin } = req.body

	if (!name || !email || !pin) {
		return res
			.status(400)
			.json({ error: 'name, email and pin are required' })
	}
	if (String(pin).length < 4) {
		return res
			.status(400)
			.json({ error: 'pin must be at least 4 characters' })
	}

	const provider_id = `pin:${String(email).toLowerCase()}`

	try {
		const [existing] = await pool.query(
			'SELECT user_id FROM users WHERE email = ? OR provider_id = ?',
			[email, provider_id]
		)
		if (existing.length) {
			return res.status(409).json({
				error: 'An account with that email already exists',
			})
		}

		const [result] = await pool.query(
			'INSERT INTO users (provider_id, email, name) VALUES (?, ?, ?)',
			[provider_id, email, name]
		)
		const user_id = result.insertId

		await pool.query(
			'INSERT INTO user_credentials (user_id, pin_hash) VALUES (?, ?)',
			[user_id, hashPin(pin)]
		)

		req.session.user = { user_id, name, email }
		res.status(201).json({
			message: 'Registered',
			user: req.session.user,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.post('/login', async (req, res) => {
	const { email, pin } = req.body

	if (!email || !pin) {
		return res
			.status(400)
			.json({ error: 'email and pin are required' })
	}

	try {
		const [users] = await pool.query(
			'SELECT user_id, name, email FROM users WHERE email = ?',
			[email]
		)

		if (!users.length) {
			return res
				.status(401)
				.json({ error: 'Invalid credentials' })
		}

		const user = users[0]

		const [creds] = await pool.query(
			'SELECT pin_hash FROM user_credentials WHERE user_id = ?',
			[user.user_id]
		)

		if (!creds.length || creds[0].pin_hash !== hashPin(pin)) {
			return res
				.status(401)
				.json({ error: 'Invalid credentials' })
		}

		// Store session
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

router.get('/me', async (req, res) => {
	if (!req.session?.user?.user_id) {
		return res.status(401).json({ error: 'Not authenticated' })
	}

	const { user_id, name, email } = req.session.user

	try {
		const [rows] = await pool.query(
			'SELECT role FROM admin_roles WHERE user_id = ?',
			[user_id]
		)

		res.json({
			user_id,
			name,
			email,
			roles: rows.map((r) => r.role),
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.post('/logout', (req, res) => {
	req.session.destroy(() => {
		res.clearCookie('connect.sid')
		res.json({ message: 'Logged out' })
	})
})

export default router
