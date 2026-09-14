import express from 'express'
import pool from '../utils/db.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Campaigns Router] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

function requireAuth(req, res, next) {
	const userId = req.session?.user?.user_id || req.user?.user_id
	if (!userId)
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	if (!req.user) req.user = req.session.user
	next()
}

async function requireEventAuthor(req, res, next) {
	const allowed = ['SUPER_ADMIN', 'EVENT_AUTHOR']
	const placeholders = allowed.map(() => '?').join(', ')
	const userId = req.session?.user?.user_id || req.user?.user_id
	try {
		const [rows] = await pool.query(
			`SELECT 1 FROM admin_roles WHERE user_id = ? AND role IN (${placeholders}) LIMIT 1`,
			[userId, ...allowed]
		)
		if (!rows.length)
			return res.status(403).json({
				error: 'Forbidden — event author role required',
			})
		next()
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
}

const VALID_STATUS = ['DRAFT', 'SCHEDULED', 'ACTIVE', 'ARCHIVED']

function toUtcDatetime(v) {
	if (v == null || v === '') return null
	const d = new Date(v)
	if (isNaN(d)) return null
	const p = (n) => String(n).padStart(2, '0')
	return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

// GET /api/campaigns — list all (authors see all, public sees SCHEDULED/ACTIVE within window)
router.get('/', async (req, res) => {
	try {
		if (req.query.all === 'true') {
			const userId =
				req.session?.user?.user_id || req.user?.user_id
			if (!userId)
				return res
					.status(401)
					.json({ error: 'Unauthorised' })
			const [roles] = await pool.query(
				`SELECT 1 FROM admin_roles WHERE user_id = ? AND role IN ('SUPER_ADMIN','EVENT_AUTHOR') LIMIT 1`,
				[userId]
			)
			if (!roles.length)
				return res
					.status(403)
					.json({ error: 'Forbidden' })
			const [rows] = await pool.query(
				`SELECT * FROM campaigns ORDER BY starts_at DESC, created_at DESC`
			)
			return res.json(rows)
		}
		// public: only ACTIVE/SCHEDULED inside window or with no window
		const [rows] = await pool.query(
			`SELECT * FROM campaigns WHERE status IN ('SCHEDULED','ACTIVE')
			   AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP())
			   AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())
			 ORDER BY starts_at ASC`
		)
		res.json(rows)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.get('/:id', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT * FROM campaigns WHERE campaign_id = ?`,
			[req.params.id]
		)
		if (!rows.length)
			return res
				.status(404)
				.json({ error: 'Campaign not found' })
		// also fetch linked events
		const [events] = await pool.query(
			`SELECT event_id, title, curation_status, is_active, starts_at, ends_at FROM events WHERE campaign_id = ? ORDER BY created_at DESC`,
			[req.params.id]
		)
		res.json({ ...rows[0], events })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.get('/:id/events', async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT * FROM events WHERE campaign_id = ? ORDER BY created_at DESC`,
			[req.params.id]
		)
		res.json(rows)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.post('/', requireAuth, requireEventAuthor, async (req, res) => {
	const {
		name,
		description,
		term,
		is_open_day,
		open_day_label,
		starts_at,
		ends_at,
		status,
	} = req.body
	if (!name || !String(name).trim())
		return res.status(400).json({ error: 'name is required' })
	if (status && !VALID_STATUS.includes(status))
		return res.status(400).json({
			error: `status must be one of ${VALID_STATUS.join(', ')}`,
		})
	try {
		const [result] = await pool.query(
			`INSERT INTO campaigns (name, description, term, is_open_day, open_day_label, starts_at, ends_at, status, created_by)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				name.trim(),
				description ?? null,
				term ?? null,
				!!is_open_day,
				open_day_label ?? null,
				toUtcDatetime(starts_at),
				toUtcDatetime(ends_at),
				status ?? 'DRAFT',
				req.user.user_id,
			]
		)
		res.status(201).json({
			message: 'Campaign created',
			campaign_id: result.insertId,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.put('/:id', requireAuth, requireEventAuthor, async (req, res) => {
	const {
		name,
		description,
		term,
		is_open_day,
		open_day_label,
		starts_at,
		ends_at,
		status,
	} = req.body
	if (status && !VALID_STATUS.includes(status))
		return res.status(400).json({
			error: `status must be one of ${VALID_STATUS.join(', ')}`,
		})
	try {
		const [existing] = await pool.query(
			`SELECT campaign_id FROM campaigns WHERE campaign_id = ?`,
			[req.params.id]
		)
		if (!existing.length)
			return res
				.status(404)
				.json({ error: 'Campaign not found' })
		const sets = []
		const vals = []
		if (name !== undefined) {
			sets.push('name = ?')
			vals.push(name)
		}
		if (description !== undefined) {
			sets.push('description = ?')
			vals.push(description)
		}
		if (term !== undefined) {
			sets.push('term = ?')
			vals.push(term)
		}
		if (is_open_day !== undefined) {
			sets.push('is_open_day = ?')
			vals.push(!!is_open_day)
		}
		if (open_day_label !== undefined) {
			sets.push('open_day_label = ?')
			vals.push(open_day_label)
		}
		if (starts_at !== undefined) {
			sets.push('starts_at = ?')
			vals.push(toUtcDatetime(starts_at))
		}
		if (ends_at !== undefined) {
			sets.push('ends_at = ?')
			vals.push(toUtcDatetime(ends_at))
		}
		if (status !== undefined) {
			sets.push('status = ?')
			vals.push(status)
		}
		if (!sets.length)
			return res
				.status(400)
				.json({ error: 'No fields to update' })
		vals.push(req.params.id)
		await pool.query(
			`UPDATE campaigns SET ${sets.join(', ')} WHERE campaign_id = ?`,
			vals
		)
		res.json({ message: 'Campaign updated' })
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

router.delete('/:id', requireAuth, requireEventAuthor, async (req, res) => {
	try {
		// unlink events first (set campaign_id null) then delete
		await pool.query(
			`UPDATE events SET campaign_id = NULL WHERE campaign_id = ?`,
			[req.params.id]
		)
		const [result] = await pool.query(
			`DELETE FROM campaigns WHERE campaign_id = ?`,
			[req.params.id]
		)
		if (!result.affectedRows)
			return res
				.status(404)
				.json({ error: 'Campaign not found' })
		res.json({
			message: 'Campaign deleted, linked events unassigned',
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

// Link / unlink events to campaign
router.post(
	'/:id/events',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const { event_ids } = req.body
		if (!Array.isArray(event_ids) || !event_ids.length)
			return res
				.status(400)
				.json({ error: 'event_ids array required' })
		try {
			const [campaign] = await pool.query(
				`SELECT campaign_id FROM campaigns WHERE campaign_id = ?`,
				[req.params.id]
			)
			if (!campaign.length)
				return res
					.status(404)
					.json({ error: 'Campaign not found' })
			await pool.query(
				`UPDATE events SET campaign_id = ? WHERE event_id IN (${event_ids.map(() => '?').join(',')})`,
				[req.params.id, ...event_ids]
			)
			res.json({
				message: `Linked ${event_ids.length} event(s) to campaign`,
			})
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

router.delete(
	'/:id/events/:eventId',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		try {
			const [result] = await pool.query(
				`UPDATE events SET campaign_id = NULL WHERE campaign_id = ? AND event_id = ?`,
				[req.params.id, req.params.eventId]
			)
			if (!result.affectedRows)
				return res.status(404).json({
					error: 'Event not linked to this campaign',
				})
			res.json({ message: 'Event unlinked from campaign' })
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

export default router
