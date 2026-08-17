import express from 'express'

import pool from '../utils/db.js'
import { error, success } from '../utils/response.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Events Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

function requireAuth(req, res, next) {
	if (!req.user?.user_id) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}
	next()
}

/**
 * Ensure the authenticated user holds at least one authoring role.
 */
function requireEventAuthor(req, res, next) {
	const allowedRoles = ['SUPER_ADMIN', 'EVENT_AUTHOR']
	const placeholders = allowedRoles.map(() => '?').join(', ')

	const sql = `
    SELECT 1 FROM admin_roles
    WHERE user_id = ?
      AND role IN (${placeholders})
    LIMIT 1
  `

	pool.query(sql, [req.user.user_id, ...allowedRoles], (err, rows) => {
		if (err) return res.status(500).json({ error: err.message })
		if (!rows.length) {
			return res.status(403).json({
				error: 'Forbidden — event author role required',
			})
		}
		next()
	})
}

router.get('/', async (req, res) => {
	try {
		const wantAll = req.query.all === 'true'
		const isAuthor =
			req.user?.user_id &&
			(
				await pool.query(
					`SELECT 1 FROM admin_roles
					 WHERE user_id = ? AND role IN ('SUPER_ADMIN','EVENT_AUTHOR') LIMIT 1`,
					[req.user.user_id]
				)
			)[0].length > 0

		const sql =
			wantAll && isAuthor
				? 'SELECT * FROM events'
				: 'SELECT * FROM events WHERE is_active = TRUE'
		const [results] = await pool.query(sql)
		res.json(results)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.get('/:id', async (req, res) => {
	try {
		const [results] = await pool.query(
			'SELECT * FROM events WHERE event_id = ?',
			[req.params.id]
		)
		if (!results.length) {
			return res
				.status(404)
				.json({ error: 'Event not found' })
		}
		res.json(results[0])
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.post('/', requireAuth, requireEventAuthor, async (req, res) => {
	const {
		title,
		description,
		latitude,
		longitude,
		radius_meters,
		point_threshold,
		point_reward,
		starts_at,
		ends_at,
		repeat_interval,
		attempt_cooldown_s,
		max_attempts_per_window,
	} = req.body

	if (!title || latitude == null || longitude == null || !radius_meters) {
		return res.status(400).json({
			error: 'title, latitude, longitude and radius_meters are required',
		})
	}

	const sql = `
    INSERT INTO events (
      title, description,
      latitude, longitude, radius_meters,
      point_threshold, point_reward,
      starts_at, ends_at,
      repeat_interval, attempt_cooldown_s, max_attempts_per_window,
      is_active, author_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
  `

	const values = [
		title,
		description ?? null,
		latitude,
		longitude,
		radius_meters,
		point_threshold ?? 0,
		point_reward ?? 10,
		starts_at ?? null,
		ends_at ?? null,
		repeat_interval ?? null,
		attempt_cooldown_s ?? 86400,
		max_attempts_per_window ?? 1,
		req.user.user_id, // author_id — always from session
	]

	try {
		const [result] = await pool.query(sql, values)
		res.status(201).json({
			message: 'Event created',
			event_id: result.insertId,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.put('/:id', requireAuth, requireEventAuthor, async (req, res) => {
	const {
		title,
		description,
		latitude,
		longitude,
		radius_meters,
		point_threshold,
		point_reward,
		starts_at,
		ends_at,
		repeat_interval,
		attempt_cooldown_s,
		max_attempts_per_window,
		is_active,
	} = req.body

	const sql = `
    UPDATE events
    SET
      title                   = ?,
      description             = ?,
      latitude                = ?,
      longitude               = ?,
      radius_meters           = ?,
      point_threshold         = ?,
      point_reward            = ?,
      starts_at               = ?,
      ends_at                 = ?,
      repeat_interval         = ?,
      attempt_cooldown_s      = ?,
      max_attempts_per_window = ?,
      is_active               = ?
    WHERE event_id = ?
  `

	const values = [
		title,
		description ?? null,
		latitude,
		longitude,
		radius_meters,
		point_threshold ?? 0,
		point_reward ?? 10,
		starts_at ?? null,
		ends_at ?? null,
		repeat_interval ?? null,
		attempt_cooldown_s ?? 86400,
		max_attempts_per_window ?? 1,
		is_active ?? true,
		req.params.id,
	]

	try {
		const [result] = await pool.query(sql, values)
		if (!result.affectedRows) {
			return res
				.status(404)
				.json({ error: 'Event not found' })
		}
		res.json({ message: 'Event updated' })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.delete('/:id', requireAuth, requireEventAuthor, async (req, res) => {
	try {
		const [result] = await pool.query(
			'DELETE FROM events WHERE event_id = ?',
			[req.params.id]
		)
		if (!result.affectedRows) {
			return res
				.status(404)
				.json({ error: 'Event not found' })
		}
		res.json({ message: 'Event deleted' })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

export default router
