import express from 'express'
import pool from '../utils/db.js'

const router = express.Router()

function requireAuth(req, res, next) {
	if (!req.user?.user_id) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}
	next()
}

// Haversine great-circle distance in metres.
function haversineMeters(lat1, lon1, lat2, lon2) {
	const R = 6371000
	const toRad = (d) => (Number(d) * Math.PI) / 180
	const dLat = toRad(lat2 - lat1)
	const dLon = toRad(lon2 - lon1)
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) *
			Math.cos(toRad(lat2)) *
			Math.sin(dLon / 2) ** 2
	return R * 2 * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * Begin a challenge attempt for an event.
 *
 * Validates that the player is within the event radius (recording a
 * location_check_log), enforces the cooldown / max-attempts gates and the
 * point threshold, then returns a random trivia question + its options.
 */
router.post('/:id/participate', requireAuth, async (req, res) => {
	const eventId = req.params.id
	const { latitude, longitude } = req.body

	if (latitude == null || longitude == null) {
		return res
			.status(400)
			.json({ error: 'latitude and longitude are required' })
	}

	try {
		const [events] = await pool.query(
			'SELECT * FROM events WHERE event_id = ? AND is_active = TRUE',
			[eventId]
		)
		if (!events.length)
			return res
				.status(404)
				.json({ error: 'Event not found' })
		const event = events[0]

		const now = new Date()
		if (event.starts_at && now < new Date(event.starts_at)) {
			return res.status(403).json({
				error: 'This event has not started yet',
			})
		}
		if (event.ends_at && now > new Date(event.ends_at)) {
			return res
				.status(403)
				.json({ error: 'This event has ended' })
		}

		// Point-threshold unlock gate
		if (Number(event.point_threshold) > 0) {
			const [[player]] = await pool.query(
				'SELECT points FROM users WHERE user_id = ?',
				[req.user.user_id]
			)
			const pts = player ? Number(player.points) : 0
			if (pts < Number(event.point_threshold)) {
				return res.status(403).json({
					error: `You need ${event.point_threshold} points to unlock this event (you have ${pts})`,
				})
			}
		}

		// Cooldown gate — most recent attempt's cooldown_until
		const [last] = await pool.query(
			'SELECT cooldown_until FROM trivia_attempts WHERE user_id = ? AND event_id = ? ORDER BY attempted_at DESC LIMIT 1',
			[req.user.user_id, eventId]
		)
		if (last.length && last[0].cooldown_until) {
			const cd = new Date(last[0].cooldown_until)
			if (cd > now) {
				return res.status(403).json({
					error: `You're on cooldown until ${cd.toLocaleString('en-ZA')}`,
					cooldown_until: last[0].cooldown_until,
				})
			}
		}

		// Max-attempts-per-window gate
		const windowS =
			event.repeat_interval ??
			event.attempt_cooldown_s ??
			86400
		const [[{ count: attemptsInWindow }]] = await pool.query(
			`SELECT COUNT(*) AS count FROM trivia_attempts
			 WHERE user_id = ? AND event_id = ?
			   AND attempted_at >= (NOW() - INTERVAL ? SECOND)`,
			[req.user.user_id, eventId, windowS]
		)
		if (attemptsInWindow >= event.max_attempts_per_window) {
			return res.status(403).json({
				error: `Max attempts (${event.max_attempts_per_window}) reached for this window — try again later`,
			})
		}

		// Location verification
		const dist = haversineMeters(
			latitude,
			longitude,
			event.latitude,
			event.longitude
		)
		const status =
			dist <= event.radius_meters ? 'VERIFIED' : 'FAILED'
		const [locResult] = await pool.query(
			`INSERT INTO location_check_log
			 (user_id, event_id, claimed_lat, claimed_lng, distance_meters, status)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				req.user.user_id,
				eventId,
				latitude,
				longitude,
				dist.toFixed(2),
				status,
			]
		)

		if (status === 'FAILED') {
			return res.status(403).json({
				error: `You're ${Math.round(dist)}m away — get within ${event.radius_meters}m of the event location.`,
				distance_meters: Math.round(dist),
			})
		}

		// Pick a random trivia question for this event
		const [questions] = await pool.query(
			'SELECT question_id, body, format, time_limit_s FROM trivia_questions WHERE event_id = ? ORDER BY RAND() LIMIT 1',
			[eventId]
		)
		if (!questions.length) {
			return res.status(409).json({
				error: 'No trivia questions have been configured for this event yet',
			})
		}
		const question = questions[0]

		const [options] = await pool.query(
			'SELECT option_id, body FROM trivia_options WHERE question_id = ? ORDER BY option_id',
			[question.question_id]
		)

		res.json({
			location_check_id: locResult.insertId,
			event: { event_id: event.event_id, title: event.title },
			question: {
				question_id: question.question_id,
				body: question.body,
				format: question.format,
				time_limit_s: question.time_limit_s,
			},
			options,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

/**
 * Submit an answer for a started attempt.
 *
 * Records the trivia_attempt (with the verified location_check_id), awards
 * point_reward on a correct answer (updating users.points + point_transactions),
 * and optionally grants a card from the event pool the first time a player
 * wins this event.
 */
router.post('/:id/answer', requireAuth, async (req, res) => {
	const eventId = req.params.id
	const { question_id, option_id, location_check_id, answer_time_ms } =
		req.body

	if (!question_id || !location_check_id) {
		return res.status(400).json({
			error: 'question_id and location_check_id are required',
		})
	}

	const conn = await pool.getConnection()
	try {
		await conn.beginTransaction()

		// Verify the location check belongs to this player+event and is verified
		const [checks] = await conn.query(
			'SELECT check_id, status FROM location_check_log WHERE check_id = ? AND user_id = ? AND event_id = ?',
			[location_check_id, req.user.user_id, eventId]
		)
		if (!checks.length) {
			await conn.rollback()
			return res
				.status(400)
				.json({ error: 'Invalid location check' })
		}
		if (checks[0].status !== 'VERIFIED') {
			await conn.rollback()
			return res.status(400).json({
				error: 'Location check was not verified',
			})
		}

		// Prevent re-using a location check for a second attempt
		const [dupes] = await conn.query(
			'SELECT 1 FROM trivia_attempts WHERE location_check_id = ?',
			[location_check_id]
		)
		if (dupes.length) {
			await conn.rollback()
			return res.status(409).json({
				error: 'This attempt has already been submitted',
			})
		}

		// Confirm the question belongs to this event
		const [qRows] = await conn.query(
			'SELECT event_id FROM trivia_questions WHERE question_id = ?',
			[question_id]
		)
		if (
			!qRows.length ||
			String(qRows[0].event_id) !== String(eventId)
		) {
			await conn.rollback()
			return res.status(400).json({
				error: 'Question does not belong to this event',
			})
		}

		// Determine correctness (a null option_id means the player timed out)
		let isCorrect = false
		if (option_id != null) {
			const [optRows] = await conn.query(
				'SELECT is_correct FROM trivia_options WHERE option_id = ? AND question_id = ?',
				[option_id, question_id]
			)
			if (!optRows.length) {
				await conn.rollback()
				return res
					.status(400)
					.json({ error: 'Invalid option' })
			}
			isCorrect = !!optRows[0].is_correct
		}

		// Load event for reward + cooldown
		const [events] = await conn.query(
			'SELECT point_reward, attempt_cooldown_s FROM events WHERE event_id = ?',
			[eventId]
		)
		const event = events[0]
		const pointsAwarded = isCorrect ? Number(event.point_reward) : 0

		const [[{ nextAttempt }]] = await conn.query(
			'SELECT COALESCE(MAX(attempt_number), 0) + 1 AS nextAttempt FROM trivia_attempts WHERE user_id = ? AND event_id = ?',
			[req.user.user_id, eventId]
		)

		const [attemptResult] = await conn.query(
			`INSERT INTO trivia_attempts
			 (user_id, event_id, question_id, location_check_id, is_correct,
			  answer_time_ms, points_awarded, attempt_number, cooldown_until)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
			[
				req.user.user_id,
				eventId,
				question_id,
				location_check_id,
				isCorrect,
				answer_time_ms ?? 0,
				pointsAwarded,
				nextAttempt,
				event.attempt_cooldown_s ?? 86400,
			]
		)
		const attemptId = attemptResult.insertId

		let cardAwarded = null
		if (isCorrect && pointsAwarded > 0) {
			await conn.query(
				'UPDATE users SET points = points + ? WHERE user_id = ?',
				[pointsAwarded, req.user.user_id]
			)
			await conn.query(
				`INSERT INTO point_transactions (user_id, delta, reason, reference_id)
				 VALUES (?, ?, 'TRIVIA_WIN', ?)`,
				[req.user.user_id, pointsAwarded, attemptId]
			)

			// First-time win for this user+event → grant a card from the pool
			const [alreadyAwarded] = await conn.query(
				'SELECT 1 FROM event_card_awards WHERE user_id = ? AND event_id = ?',
				[req.user.user_id, eventId]
			)
			if (!alreadyAwarded.length) {
				const [pool] = await conn.query(
					'SELECT pool_id, card_id, weight, global_copy_limit, copies_awarded FROM event_card_pool WHERE event_id = ?',
					[eventId]
				)
				const eligible = pool.filter(
					(p) =>
						p.global_copy_limit == null ||
						p.copies_awarded <
							p.global_copy_limit
				)
				if (eligible.length) {
					const totalWeight = eligible.reduce(
						(s, p) => s + Number(p.weight),
						0
					)
					let r = Math.random() * totalWeight
					let chosen = eligible[0]
					for (const p of eligible) {
						r -= Number(p.weight)
						if (r <= 0) {
							chosen = p
							break
						}
					}

					await conn.query(
						'INSERT INTO event_card_awards (user_id, event_id, card_id) VALUES (?, ?, ?)',
						[
							req.user.user_id,
							eventId,
							chosen.card_id,
						]
					)
					await conn.query(
						'UPDATE event_card_pool SET copies_awarded = copies_awarded + 1 WHERE pool_id = ?',
						[chosen.pool_id]
					)
					await conn.query(
						`INSERT INTO user_cards (user_id, card_id, quantity)
						 VALUES (?, ?, 1)
						 ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
						[
							req.user.user_id,
							chosen.card_id,
						]
					)
					const [[card]] = await conn.query(
						'SELECT card_id, name FROM cards WHERE card_id = ?',
						[chosen.card_id]
					)
					cardAwarded = card
				}
			}
		}

		const [[correct]] = await conn.query(
			'SELECT option_id FROM trivia_options WHERE question_id = ? AND is_correct = TRUE LIMIT 1',
			[question_id]
		)
		const [[player]] = await conn.query(
			'SELECT points FROM users WHERE user_id = ?',
			[req.user.user_id]
		)

		await conn.commit()

		res.json({
			is_correct: isCorrect,
			correct_option_id: correct ? correct.option_id : null,
			points_awarded: pointsAwarded,
			new_points_total: player ? Number(player.points) : 0,
			card_awarded: cardAwarded,
			attempt_number: nextAttempt,
		})
	} catch (err) {
		await conn.rollback()
		res.status(500).json({ error: err.message })
	} finally {
		conn.release()
	}
})

export default router
