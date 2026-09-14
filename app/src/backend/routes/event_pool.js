import express from 'express'

import pool from '../utils/db.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Pool Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

function requireAuth(req, res, next) {
	const userId = req.session?.user?.user_id || req.user?.user_id
	if (!userId) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}
	if (!req.user) {
		req.user = req.session.user
	}
	next()
}

async function requireEventAuthor(req, res, next) {
	const allowedRoles = ['SUPER_ADMIN', 'EVENT_AUTHOR']
	const placeholders = allowedRoles.map(() => '?').join(', ')

	const sql = `
		SELECT 1 FROM admin_roles
		WHERE user_id = ?
			AND role IN (${placeholders})
		LIMIT 1
	`

	try {
		const [rows] = await pool.query(sql, [
			req.user.user_id,
			...allowedRoles,
		])
		if (!rows.length) {
			return res.status(403).json({
				error: 'Forbidden — event author role required',
			})
		}
		next()
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
}

router.get(
	'/:eventId/pool',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		try {
			const [rows] = await pool.query(
				`SELECT ecp.pool_id, ecp.event_id, ecp.card_id, ecp.weight,
					ecp.global_copy_limit, ecp.copies_awarded,
					c.name, c.rarity, c.category, c.image_url
			 FROM event_card_pool ecp
			 JOIN cards c ON ecp.card_id = c.card_id
			 WHERE ecp.event_id = ?
			 ORDER BY FIELD(c.rarity,'COMMON','UNCOMMON','RARE','EPIC','LEGENDARY') ASC,
					  c.name ASC`,
				[req.params.eventId]
			)
			res.json(rows)
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

router.post(
	'/:eventId/pool',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const { card_id, weight, global_copy_limit } = req.body

		if (
			!card_id ||
			!Number.isInteger(Number(card_id)) ||
			Number(card_id) < 1
		) {
			return res.status(400).json({
				error: 'card_id is required and must be a positive integer',
			})
		}

		const w = weight ? parseInt(weight, 10) : 1
		if (w < 1) {
			return res.status(400).json({
				error: 'weight must be a positive integer',
			})
		}

		const limit =
			global_copy_limit != null && global_copy_limit !== ''
				? parseInt(global_copy_limit, 10)
				: null
		if (limit !== null && limit < 1) {
			return res.status(400).json({
				error: 'global_copy_limit must be a positive integer or null',
			})
		}

		try {
			const [result] = await pool.query(
				`INSERT INTO event_card_pool (event_id, card_id, weight, global_copy_limit)
			 VALUES (?, ?, ?, ?)`,
				[req.params.eventId, card_id, w, limit]
			)
			res.status(201).json({
				message: 'Card added to pool',
				pool_id: result.insertId,
			})
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') {
				return res.status(409).json({
					error: "Card is already in this event's pool",
				})
			}
			res.status(500).json({ error: err.message })
		}
	}
)

router.put(
	'/:eventId/pool/:poolId',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const { weight, global_copy_limit } = req.body

		const w = weight != null ? parseInt(weight, 10) : null
		const limit =
			global_copy_limit != null && global_copy_limit !== ''
				? parseInt(global_copy_limit, 10)
				: null

		if (w !== null && w < 1) {
			return res.status(400).json({
				error: 'weight must be a positive integer',
			})
		}
		if (limit !== null && limit < 1) {
			return res.status(400).json({
				error: 'global_copy_limit must be a positive integer or null',
			})
		}

		const sets = []
		const vals = []
		if (w !== null) {
			sets.push('weight = ?')
			vals.push(w)
		}
		if (req.body.hasOwnProperty('global_copy_limit')) {
			sets.push('global_copy_limit = ?')
			vals.push(limit)
		}

		if (!sets.length) {
			return res.status(400).json({
				error: 'Provide at least weight or global_copy_limit',
			})
		}

		vals.push(req.params.poolId, req.params.eventId)

		try {
			const [result] = await pool.query(
				`UPDATE event_card_pool SET ${sets.join(', ')} WHERE pool_id = ? AND event_id = ?`,
				vals
			)
			if (!result.affectedRows) {
				return res
					.status(404)
					.json({ error: 'Pool entry not found' })
			}
			res.json({ message: 'Pool entry updated' })
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

router.delete(
	'/:eventId/pool/:poolId',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		try {
			const [result] = await pool.query(
				'DELETE FROM event_card_pool WHERE pool_id = ? AND event_id = ?',
				[req.params.poolId, req.params.eventId]
			)
			if (!result.affectedRows) {
				return res
					.status(404)
					.json({ error: 'Pool entry not found' })
			}
			res.json({ message: 'Card removed from pool' })
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

export default router
