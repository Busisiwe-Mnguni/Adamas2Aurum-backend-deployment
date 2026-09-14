import express from 'express'
import pool from '../utils/db.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Analytics Router] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
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

// GET /api/analytics/questions/hard — questions everybody gets wrong
// Query: threshold=0.6 (failure rate), min_attempts=5, limit=20
router.get(
	'/questions/hard',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const threshold = parseFloat(req.query.threshold) || 0.5
		const minAttempts = parseInt(req.query.min_attempts, 10) || 5
		const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100)
		try {
			// Prefer trivia_attempts which is populated by live submit; fallback to offline queue already counted
			const [rows] = await pool.query(
				`SELECT
				tq.question_id AS id,
				tq.event_id,
				tq.format AS type,
				tq.body AS text,
				e.title AS event_title,
				COUNT(ta.attempt_id) AS attempts,
				SUM(CASE WHEN ta.is_correct = 0 THEN 1 ELSE 0 END) AS wrong,
				ROUND(SUM(CASE WHEN ta.is_correct = 0 THEN 1 ELSE 0 END) / COUNT(ta.attempt_id), 3) AS failure_rate,
				SUM(CASE WHEN ta.is_correct = 1 THEN 1 ELSE 0 END) AS correct
			 FROM trivia_questions tq
			 JOIN events e ON e.event_id = tq.event_id
			 JOIN trivia_attempts ta ON ta.question_id = tq.question_id
			 GROUP BY tq.question_id, tq.event_id, tq.format, tq.body, e.title
			 HAVING attempts >= ? AND failure_rate >= ?
			 ORDER BY failure_rate DESC, attempts DESC
			 LIMIT ?`,
				[minAttempts, threshold, limit]
			)
			// enrich with options for repair UI (without leaking is_correct to player view but author can see)
			for (const q of rows) {
				const [opts] = await pool.query(
					`SELECT option_id, body, is_correct FROM trivia_options WHERE question_id = ?`,
					[q.id]
				)
				q.options = opts
				// convert to numbers
				q.attempts = Number(q.attempts)
				q.wrong = Number(q.wrong)
				q.correct = Number(q.correct)
				q.failure_rate = Number(q.failure_rate)
			}
			res.json(rows)
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

// GET /api/analytics/events/stale — old/expired events that should be retired
router.get(
	'/events/stale',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const days = parseInt(req.query.days, 10) || 30
		try {
			const [rows] = await pool.query(
				`SELECT event_id, title, curation_status, is_active, starts_at, ends_at, campaign_id, created_at,
			        DATEDIFF(UTC_TIMESTAMP(), COALESCE(ends_at, created_at)) AS days_since_end
			 FROM events
			 WHERE (ends_at IS NOT NULL AND ends_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY))
			    OR (ends_at IS NULL AND created_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) AND curation_status = 'PUBLISHED')
			 ORDER BY ends_at ASC
			 LIMIT 50`,
				[days, days]
			)
			res.json(rows)
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

// GET /api/analytics/overview — counts per status for dashboard
router.get('/overview', requireAuth, requireEventAuthor, async (req, res) => {
	try {
		const [statusCounts] = await pool.query(
			`SELECT curation_status AS status, COUNT(*) AS count FROM events GROUP BY curation_status`
		)
		const [campaignCounts] = await pool.query(
			`SELECT status, COUNT(*) AS count FROM campaigns GROUP BY status`
		)
		const [hardCount] = await pool.query(
			`SELECT COUNT(*) AS hard_questions FROM (
				SELECT tq.question_id FROM trivia_questions tq JOIN trivia_attempts ta ON ta.question_id = tq.question_id
				GROUP BY tq.question_id HAVING COUNT(*) >= 5 AND SUM(CASE WHEN ta.is_correct=0 THEN 1 ELSE 0 END)/COUNT(*) >= 0.5
			) x`
		)
		const [staleCount] = await pool.query(
			`SELECT COUNT(*) AS stale FROM events WHERE ends_at IS NOT NULL AND ends_at < DATE_SUB(UTC_TIMESTAMP(), INTERVAL 30 DAY) AND curation_status != 'RETIRED'`
		)
		res.json({
			statusCounts,
			campaignCounts,
			hard_questions: hardCount[0].hard_questions,
			stale_events: staleCount[0].stale,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

export default router
