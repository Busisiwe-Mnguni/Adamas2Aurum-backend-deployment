import express from 'express'

import pool from '../utils/db.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Leaderboard Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

// ── Helpers ──────────────────────────────────────────────────

/**
 * Clamp a numeric query param into a safe range.
 * Guards against `?limit=9999999` / `?limit=banana` / negative offsets.
 */
function clampInt(value, { min, max, fallback }) {
	const n = Number.parseInt(value, 10)
	if (Number.isNaN(n)) return fallback
	return Math.min(Math.max(n, min), max)
}

/**
 * Build the base leaderboard SELECT.
 *
 * User Story 7 (Sprint 2, Intermediate): "rank against everyone else
 * by points". The authoritative column for points is `users.points` —
 * it is incremented by the trivia submit path. `leaderboard_entries`
 * (season-scoped wins/losses/score) exists in the schema but nothing
 * currently writes to it, so we LEFT JOIN it purely to surface
 * wins/losses when present. If it's empty, the join still returns
 * NULL for those columns and the response stays valid.
 *
 * ORDER: points DESC, then user_id ASC as a stable tiebreak.
 * A leaderboard with pagination needs a deterministic total order,
 * otherwise players with equal points can appear on two pages at once
 * (or vanish between pages) depending on MySQL's row order.
 */
const LEADERBOARD_SELECT = `
	SELECT
		u.user_id,
		u.name,
		u.avatar_url,
		u.points,
		COALESCE(le.wins, 0)   AS wins,
		COALESCE(le.losses, 0) AS losses
	FROM users u
	LEFT JOIN (
		SELECT user_id, MAX(wins) AS wins, MAX(losses) AS losses
		FROM leaderboard_entries
		GROUP BY user_id
	) le ON le.user_id = u.user_id
	ORDER BY u.points DESC, u.user_id ASC
`

// ── GET /api/leaderboard ─────────────────────────────────────
// Public read. Anonymous visitors get the same top-N list as anyone
// else — ranking is public information. Only the caller's own rank
// (see /me below) requires a session.
router.get('/', async (req, res) => {
	const limit = clampInt(req.query.limit, {
		min: 1,
		max: 100,
		fallback: 50,
	})
	const offset = clampInt(req.query.offset, {
		min: 0,
		max: 1_000_000,
		fallback: 0,
	})

	try {
		const [[{ total }]] = await pool.query(
			'SELECT COUNT(*) AS total FROM users'
		)

		const [rows] = await pool.query(
			`${LEADERBOARD_SELECT} LIMIT ? OFFSET ?`,
			[limit, offset]
		)

		// Rank is 1-based and global (offset + position in this page).
		const entries = rows.map((row, index) => ({
			rank: offset + index + 1,
			user_id: row.user_id,
			name: row.name,
			avatar_url: row.avatar_url,
			points: row.points,
			wins: row.wins,
			losses: row.losses,
		}))

		res.json({
			entries,
			total,
			limit,
			offset,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

// ── GET /api/leaderboard/me ──────────────────────────────────
// Requires a session. Returns the caller's rank, points, total
// players, and a window of neighbours (±2) so the frontend can show
// "you're #47, just behind X" without paging through the whole list.
//
// Note: this route is declared BEFORE any '/:something' route in this
// file, so 'me' is never captured as a parameter. Keep it that way if
// you add routes later.
router.get('/me', async (req, res) => {
	const userId = req.session?.user?.user_id || req.user?.user_id
	if (!userId) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}

	try {
		// Confirm the user still exists — a stale session cookie from a
		// previous seed run should 404, not 500.
		const [[me]] = await pool.query(
			'SELECT user_id, name, avatar_url, points FROM users WHERE user_id = ?',
			[userId]
		)
		if (!me) {
			return res.status(404).json({ error: 'User not found' })
		}

		// Global rank = (number of users strictly ahead) + 1.
		// "Strictly ahead" uses the same ORDER BY as the main list, so
		// ties resolve identically: more points wins, then lower user_id.
		const [[{ ahead }]] = await pool.query(
			`SELECT COUNT(*) AS ahead
			 FROM users
			 WHERE points > ?
			    OR (points = ? AND user_id < ?)`,
			[me.points, me.points, me.user_id]
		)
		const rank = ahead + 1

		const [[{ total }]] = await pool.query(
			'SELECT COUNT(*) AS total FROM users'
		)

		// Neighbour window: two rows above, two below, by the same
		// global ORDER BY. Fetching the 5-row slice around the user
		// avoids loading the entire table just to slice it in JS.
		const windowStart = Math.max(0, rank - 3)
		const [neighbours] = await pool.query(
			`${LEADERBOARD_SELECT} LIMIT ? OFFSET ?`,
			[5, windowStart]
		)

		const neighboursWithRank = neighbours.map((row, i) => ({
			rank: windowStart + i + 1,
			user_id: row.user_id,
			name: row.name,
			avatar_url: row.avatar_url,
			points: row.points,
			wins: row.wins,
			losses: row.losses,
		}))

		res.json({
			rank,
			points: me.points,
			total_players: total,
			entry: {
				rank,
				user_id: me.user_id,
				name: me.name,
				avatar_url: me.avatar_url,
				points: me.points,
			},
			neighbours: neighboursWithRank,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

export default router
