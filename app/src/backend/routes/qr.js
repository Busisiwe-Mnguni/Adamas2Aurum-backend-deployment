/**
 * routes/qr.js — QR fallback verification for low-accuracy GPS
 *
 * Flow:
 *   1. Admin visits GET /api/events/:id/qr-token → gets a signed token
 *      (they print this as a QR code and place it at the physical location)
 *   2. Player's GPS accuracy > GPS_ACCURACY_THRESHOLD_M → frontend shows
 *      camera overlay instead of sending GPS coords
 *   3. Player scans the QR → frontend sends token to
 *      POST /api/events/:id/verify-qr
 *   4. Backend validates token → returns same shape as GPS verification
 *      so trivia.js can treat both paths identically
 */

import express from 'express'
import crypto from 'crypto'
import pool from '../utils/db.js'

const router = express.Router()

// ── Accuracy threshold ────────────────────────────────────────
// If the browser reports GPS accuracy worse than this (in metres),
// the frontend should trigger QR fallback instead of GPS.
// Exported so trivia.js can import and use the same value.
export const GPS_ACCURACY_THRESHOLD_M = 50

// ── Middleware ────────────────────────────────────────────────
function requireAuth(req, res, next) {
	const userId = req.session?.user?.user_id || req.user?.user_id
	if (!userId) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}
	if (!req.user) req.user = req.session.user
	next()
}

function requireEventAuthor(req, res, next) {
	const allowedRoles = ['SUPER_ADMIN', 'EVENT_AUTHOR']
	const placeholders = allowedRoles.map(() => '?').join(', ')
	const userId = req.session?.user?.user_id || req.user?.user_id

	pool.query(
		`SELECT 1 FROM admin_roles WHERE user_id = ? AND role IN (${placeholders}) LIMIT 1`,
		[userId, ...allowedRoles],
		(err, rows) => {
			if (err)
				return res
					.status(500)
					.json({ error: err.message })
			if (!rows.length)
				return res.status(403).json({
					error: 'Forbidden — event author role required',
				})
			next()
		}
	)
}

// ── Token lifetime ────────────────────────────────────────────
const TOKEN_TTL_HOURS = 24

// ============================================================
//  GET /api/events/:id/qr-token
//
//  Author-only. Generates (or refreshes) a QR token for an
//  event. The token is a 32-byte random hex string that encodes
//  no information by itself — the server looks it up in the DB
//  to find which event it belongs to and whether it's expired.
//
//  Admins call this once, then print the returned `qr_url`
//  as a QR code (or use the `token` directly in any QR
//  generator). The QR code is physically placed at the location.
// ============================================================
router.get(
	'/:id/qr-token',
	requireAuth,
	requireEventAuthor,
	async (req, res) => {
		const eventId = parseInt(req.params.id, 10)

		try {
			// Confirm the event exists
			const [events] = await pool.query(
				'SELECT event_id, title FROM events WHERE event_id = ?',
				[eventId]
			)
			if (!events.length) {
				return res
					.status(404)
					.json({ error: 'Event not found' })
			}

			// Invalidate any existing unexpired token for this event
			// so only one valid QR exists at a time per event
			await pool.query(
				'DELETE FROM event_qr_tokens WHERE event_id = ?',
				[eventId]
			)

			// Generate new token
			const token = crypto.randomBytes(32).toString('hex')
			const expiresAt = new Date(
				Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000
			)

			await pool.query(
				'INSERT INTO event_qr_tokens (event_id, token, expires_at) VALUES (?, ?, ?)',
				[eventId, token, expiresAt]
			)

			// The QR code should encode this URL — when scanned it carries
			// the token back to the frontend via the URL hash/query param
			const qr_url = `${process.env.APP_URL || 'http://localhost:3000'}/pages/events.html?qr=${token}`

			res.json({
				event_id: eventId,
				event_title: events[0].title,
				token,
				qr_url,
				expires_at: expiresAt.toISOString(),
				ttl_hours: TOKEN_TTL_HOURS,
				instructions: `Print this URL as a QR code and place it at the "${events[0].title}" location. Valid for ${TOKEN_TTL_HOURS} hours.`,
			})
		} catch (err) {
			res.status(500).json({ error: err.message })
		}
	}
)

// ============================================================
//  POST /api/events/:id/verify-qr
//
//  Player-facing. Called by the frontend after scanning a QR
//  code when GPS accuracy is too poor. Validates the token and
//  returns the same { verified, status } shape that the GPS
//  path in trivia.js produces, so trivia.js can treat both
//  paths identically.
//
//  Does NOT hand out a trivia question — that still happens
//  via GET /api/trivia/event/:id. This route only confirms
//  presence so trivia.js can skip the GPS check.
// ============================================================
router.post('/:id/verify-qr', requireAuth, async (req, res) => {
	const eventId = parseInt(req.params.id, 10)
	const { token } = req.body

	if (!token) {
		return res.status(400).json({ error: 'token is required' })
	}

	try {
		const [rows] = await pool.query(
			`SELECT token_id, event_id, expires_at
             FROM event_qr_tokens
             WHERE token = ? AND event_id = ?`,
			[token, eventId]
		)

		if (!rows.length) {
			return res.status(403).json({
				verified: false,
				status: 'FAILED',
				error: 'Invalid QR code — this code does not belong to this event.',
			})
		}

		const qrRow = rows[0]

		if (new Date() > new Date(qrRow.expires_at)) {
			return res.status(403).json({
				verified: false,
				status: 'FAILED',
				error: 'This QR code has expired. Ask an admin to regenerate it.',
			})
		}

		// Valid — log it so trivia.js can reference this check_id
		const [locCheck] = await pool.query(
			`INSERT INTO location_check_log
               (user_id, event_id, claimed_lat, claimed_lng, distance_meters, status)
             VALUES (?, ?, 0, 0, 0, 'FALLBACK_QR')`,
			[
				req.session?.user?.user_id || req.user?.user_id,
				eventId,
			]
		)

		res.json({
			verified: true,
			status: 'FALLBACK_QR',
			location_check_id: locCheck.insertId,
			message: 'QR code verified — you may now attempt the challenge.',
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

export default router
