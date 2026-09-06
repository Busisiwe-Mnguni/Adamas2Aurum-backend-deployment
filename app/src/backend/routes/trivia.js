import express from 'express'
import pool from '../utils/db.js'
import { distance_meters } from '../utils/geo.js'
import { canAwardCard, awardCardIfEligible } from '../services/card_award.js'
import { analyzeMovement } from '../services/movementTrust.js'

const router = express.Router()

// Blocks access to a route unless the player has an active login session.
// req.session.user is populated either by the PIN-based /auth/login route,
// or by the Better Auth bridge middleware in server.js — both end up
// setting the same { user_id, name, email } shape, so this check works
// the same regardless of which auth method the player used.
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

// Whether opening/answering a challenge requires the player to actually be
// within the event's radius_meters. Defaults to true (the real intended
// behaviour). Set REQUIRE_LOCATION_VERIFICATION=false in .env for local
// testing on machines without real GPS (e.g. a desktop/VM relying on
// inaccurate WiFi-based positioning) — see the geolocation accuracy
// discussion from earlier: desktop positioning can be off by hundreds of
// meters, which would otherwise block every attempt during dev.
const LOCATION_VERIFICATION_ENABLED =
	process.env.REQUIRE_LOCATION_VERIFICATION !== 'false'

/**
 * Looks up an event's location + radius from the DB. Shared by both routes
 * below so the "how far is the player" logic only lives in one place.
 */
async function getEventLocation(eventId) {
	const [rows] = await pool.query(
		`SELECT latitude, longitude, radius_meters, point_reward FROM events WHERE event_id = ?`,
		[eventId]
	)
	return rows[0] || null
}

/**
 * GET TRIVIA QUESTION FOR AN EVENT
 *
 * Called when a player clicks "Attempt Challenge" on a map pin. Picks one
 * random question tied to that event, then fetches its answer options.
 *
 * LOCATION CHECK (new): the frontend now sends the player's current
 * coordinates as ?lat=..&lng=.. query params (see geolocation.js's
 * get_player_location(), wired up in main.js's handleChallengeAttempt).
 * If the player is further from the event than its radius_meters allows,
 * this route refuses to hand out the question at all — satisfying user
 * story 7's "when I open a challenge I'm at" wording literally, rather
 * than only checking distance after the fact at submit time.
 *
 * IMPORTANT: this still only sends back option_id and body (the text shown
 * on each button) — it deliberately does NOT include the is_correct
 * column. If it did, a player could open their browser's Network tab and
 * read the answer straight off the API response before even attempting
 * the question. Keeping correctness server-side-only is what makes the
 * whole quiz trustworthy.
 */
router.get('/event/:eventId', requireAuth, async (req, res) => {
	try {
		const { eventId } = req.params
		const { lat, lng } = req.query

		if (LOCATION_VERIFICATION_ENABLED) {
			const event = await getEventLocation(eventId)
			if (!event) {
				return res
					.status(404)
					.json({ error: 'Event not found.' })
			}

			if (lat === undefined || lng === undefined) {
				// The frontend should always send these — this only fires if
				// geolocation failed client-side and the caller didn't handle
				// that, or if the endpoint is hit directly (e.g. via curl).
				return res.status(400).json({
					error: 'Location is required to attempt this challenge.',
				})
			}

			const distance = distance_meters(
				parseFloat(lat),
				parseFloat(lng),
				parseFloat(event.latitude),
				parseFloat(event.longitude)
			)

			if (distance > event.radius_meters) {
				return res.status(403).json({
					error: 'You are too far from this location to attempt the challenge.',
					distance_meters: Math.round(distance),
					radius_meters: event.radius_meters,
				})
			}
		}

		// ORDER BY RAND() LIMIT 1 = pick one random question for this event,
		// so the same location doesn't always ask the same question.
		const [questions] = await pool.query(
			`SELECT question_id, format, body, time_limit_s, difficulty
       FROM trivia_questions
       WHERE event_id = ?
       ORDER BY RAND() LIMIT 1`,
			[eventId]
		)

		if (!questions.length) {
			// No trivia_questions rows exist for this event_id in the DB yet.
			return res.status(404).json({
				error: 'No active trivia questions found for this location.',
			})
		}

		const question = questions[0]

		// Fetch every answer choice for that specific question. Note: no
		// is_correct here, see comment above the route.
		const [options] = await pool.query(
			`SELECT option_id, body FROM trivia_options WHERE question_id = ?`,
			[question.question_id]
		)

		// User story 8 — tell the frontend up front whether this player
		// has ALREADY earned this event's card, so it can show a
		// "replay for practice?" banner instead of silently letting them
		// redo it for no reward. canAwardCard reads the attempt log (the
		// source of truth), NOT card ownership — a player could trade or
		// lose a card later, so ownership is not a reliable "did they ever
		// win here?" signal.
		const player_id = req.session.user.user_id
		const already_earned = !(await canAwardCard(
			pool,
			player_id,
			eventId
		))

		let earned_card = null
		if (already_earned) {
			const [cardRows] = await pool.query(
				`SELECT c.card_id, c.name, c.image_url, c.rarity
           FROM event_card_awards eca
           JOIN cards c ON eca.card_id = c.card_id
          WHERE eca.user_id = ? AND eca.event_id = ?
          LIMIT 1`,
				[player_id, eventId]
			)
			earned_card = cardRows[0] || null
		}

		res.json({
			question_id: question.question_id,
			body: question.body, // the actual question text
			format: question.format, // e.g. MULTIPLE_CHOICE, TRUE_FALSE
			time_limit_s: question.time_limit_s,
			options: options, // array of { option_id, body }
			card_eligibility: {
				// user story 8 — once-only card banner
				already_earned, // true = this player has won this event before
				earned_card, // { card_id, name, image_url, rarity } | null
			},
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

/**
 * SUBMIT TRIVIA ANSWER & AWARD POINTS
 *
 * Called when the player clicks one of the answer buttons. The frontend
 * sends back only IDs (which question, which option they picked) — the
 * server does the actual grading, since the client can never be trusted
 * to correctly self-report whether it got the answer right.
 *
 * LOCATION CHECK (new): the frontend now also sends claimed_lat/claimed_lng
 * in the request body, captured fresh at submit time (not reused from when
 * the question was first opened) — this means a player who walked away
 * from the location between opening the question and answering it gets
 * caught here too, not just at the GET step above.
 *
 * The real distance is now computed and stored in location_check_log
 * (previously this hardcoded 0, 0, 0, 'VERIFIED' unconditionally — see the
 * old comment that used to be here). Points are only awarded if BOTH the
 * answer was correct AND the location check passed.
 *
 * User story 7: "As a player, when I open a challenge I'm at, I'm shown a
 * question and my answer is checked by the server — and I see the correct
 * answer afterward regardless of whether I got it right." The
 * correct_option_text field added below is what satisfies the second half
 * of that story.
 */
router.post('/submit', requireAuth, async (req, res) => {
	const {
		event_id,
		question_id,
		selected_option_id,
		answer_time_ms,
		claimed_lat,
		claimed_lng,
	} = req.body
	const user_id = req.session.user.user_id // comes from the session cookie, not the request body — a player can't spoof this to submit as someone else

	if (!question_id || !selected_option_id) {
		return res.status(400).json({
			error: 'question_id and selected_option_id are required',
		})
	}

	try {
		// STEP 1: Look up whether the option the player picked is flagged
		// correct in the DB. The WHERE clause checks BOTH option_id AND
		// question_id together — this stops someone from submitting an
		// option_id that belongs to a totally different question (which
		// could otherwise be used to game the grading).
		const [options] = await pool.query(
			`SELECT is_correct FROM trivia_options WHERE option_id = ? AND question_id = ?`,
			[selected_option_id, question_id]
		)

		if (!options.length) {
			// The option_id/question_id pairing didn't match any row — either
			// a bad request or someone tampering with the payload.
			return res
				.status(404)
				.json({ error: 'Invalid option selected' })
		}

		// is_correct comes back from MySQL as 0/1 (TINYINT); Boolean(...)
		// converts that to a clean true/false for use in JS logic below.
		const isCorrect = Boolean(options[0].is_correct)

		// STEP 2: Separately, find whichever option for this question IS the
		// correct one — regardless of what the player picked. This is what
		// lets us always show the correct answer afterward (user story 7),
		// not just when the player got it wrong.
		const [correctOptionRows] = await pool.query(
			`SELECT option_id, body FROM trivia_options WHERE question_id = ? AND is_correct = 1 LIMIT 1`,
			[question_id]
		)
		const correctOption = correctOptionRows[0] || null // null-safe in case a question was seeded without a correct option marked

		// STEP 3: Look up the event (for point_reward AND now for location
		// verification too — reusing the same shared helper as the GET route
		// above, so both endpoints agree on what "close enough" means).
		const event = await getEventLocation(event_id)

		// STEP 4: Actually verify location, if enabled. distance stays null
		// and status stays 'VERIFIED' when verification is turned off (dev/
		// testing mode) — matching the previous stub behaviour exactly, so
		// nothing breaks for teammates who haven't set the env flag.
		let distance = null
		let locationStatus = 'VERIFIED'

		if (LOCATION_VERIFICATION_ENABLED) {
			if (!event) {
				return res
					.status(404)
					.json({ error: 'Event not found.' })
			}
			if (
				claimed_lat === undefined ||
				claimed_lng === undefined
			) {
				return res.status(400).json({
					error: 'Location is required to submit an answer.',
				})
			}

			distance = distance_meters(
				parseFloat(claimed_lat),
				parseFloat(claimed_lng),
				parseFloat(event.latitude),
				parseFloat(event.longitude)
			)
			locationStatus =
				distance <= event.radius_meters
					? 'VERIFIED'
					: 'REJECTED'
		}

		// STEP 5: Check movement trust against the player's last location
		// check BEFORE deciding points — a spoofed jump shouldn't earn points
		// even if it lands inside the event radius.
		const movement = await analyzeMovement(
			user_id,
			parseFloat(claimed_lat) || 0,
			parseFloat(claimed_lng) || 0
		)
		const finalStatus =
			locationStatus === 'VERIFIED' && movement.isSuspicious
				? 'SPOOFED'
				: locationStatus
		const locationVerified = finalStatus === 'VERIFIED'

		// Points require a correct answer AND a verified (non-spoofed)
		// location — someone who answers correctly from outside the radius,
		// or via an impossible teleport between attempts, still shouldn't be
		// rewarded.
		const pointsAwarded =
			isCorrect && locationVerified
				? event?.point_reward || 10
				: 0
		// STEP 6: ATOMIC AWARD + LOG + POINTS (user story 8).
		//
		// The eligibility check, the award-ledger insert (event_card_awards,
		// whose UNIQUE(user_id, event_id) is the hard backstop against a
		// double-submit race), the inventory upsert, the attempt record, and
		// the points ledger all commit together — or none do. The eligibility
		// check runs BEFORE the attempt is inserted, so a winning
		// retry-after-win sees the prior win and is correctly told "no new card".
		const conn = await pool.getConnection()
		let award = {
			awarded: false,
			card: null,
			card_id: null,
			reason: 'NOT_A_WIN',
		}
		try {
			await conn.beginTransaction()

			// 6a. Log the location check with REAL values (including the
			// previously-unused prev_check_id / travel_speed_ms columns), and
			// finalStatus computed above in STEP 5.
			const [locCheck] = await conn.query(
				`INSERT INTO location_check_log (user_id, event_id, claimed_lat, claimed_lng, distance_meters, status, prev_check_id, travel_speed_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					user_id,
					event_id,
					claimed_lat ?? 0,
					claimed_lng ?? 0,
					distance !== null
						? Math.round(distance)
						: 0,
					finalStatus,
					movement.prevCheckId,
					movement.travelSpeedMps,
				]
			)

			// 6b. Award the card — once-only. Only a correct, location-verified
			// answer is even eligible; a wrong or out-of-range attempt is still
			// logged in 6c but never triggers issuance. awardCardIfEligible does
			// the canAwardCard check itself, so a retry after a prior win returns
			// ALREADY_EARNED and touches nothing.
			award =
				isCorrect && finalStatus === 'VERIFIED'
					? await awardCardIfEligible(conn, {
							user_id,
							event_id,
						})
					: {
							awarded: false,
							card: null,
							card_id: null,
							reason: 'NOT_A_WIN',
						}

			// 6c. Record the attempt itself, carrying the awarded card_id (or
			// NULL). This row is what canAwardCard later queries to answer
			// "has this player ever won this event?" — so it MUST be inserted
			// after, not before, the award check (see the ordering note above).
			await conn.query(
				`INSERT INTO trivia_attempts
           (user_id, event_id, question_id, location_check_id, is_correct, answer_time_ms, card_awarded_id, points_awarded)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					user_id,
					event_id,
					question_id,
					locCheck.insertId,
					isCorrect,
					answer_time_ms || 0,
					award.card_id,
					pointsAwarded,
				]
			)

			// 6d. Only touch the points ledger when points were actually
			// awarded — avoids a redundant 0-point UPDATE. Note: points are
			// awarded on every correct+verified answer, including retries for
			// practice; only the CARD is once-only (the story's scope).
			if (pointsAwarded > 0) {
				await conn.query(
					`UPDATE users SET points = points + ? WHERE user_id = ?`,
					[pointsAwarded, user_id]
				)
				await conn.query(
					`INSERT INTO point_transactions (user_id, delta, reason, reference_id) VALUES (?, ?, 'TRIVIA_WIN', ?)`,
					[user_id, pointsAwarded, event_id]
				)
			}

			await conn.commit()
		} catch (txErr) {
			await conn.rollback()
			throw txErr
		} finally {
			conn.release()
		}

		// STEP 7: Build the message, now accounting for the card outcome
		// (awarded / already-earned / correct-only / wrong / too-far) so a
		// retry-after-win reads as intended behaviour, not a silent bug.
		let message
		if (!locationVerified) {
			message =
				'You were too far from this location for that attempt to count.'
		} else if (isCorrect && award.awarded) {
			message = `Correct! You earned ${pointsAwarded} points and a new card: ${award.card.name}!`
		} else if (isCorrect && award.reason === 'ALREADY_EARNED') {
			message = `Correct! You earned ${pointsAwarded} points. You've already earned this card — no new card this time.`
		} else if (isCorrect) {
			message = `Correct! You earned ${pointsAwarded} points.`
		} else {
			message = 'Incorrect answer. Try again later!'
		}

		res.json({
			success: true,
			is_correct: isCorrect,
			location_verified: locationVerified,
			distance_meters:
				distance !== null ? Math.round(distance) : null,
			points_awarded: pointsAwarded,
			card_awarded: award.awarded, // user story 8 — was a new card issued this attempt?
			awarded_card: award.card, // { card_id, name, image_url, rarity, category } | null
			already_earned_card: award.reason === 'ALREADY_EARNED', // true on a winning retry-after-win
			correct_option_id: correctOption?.option_id ?? null, // optional chaining + nullish coalescing: safely handles the case where correctOption is null
			correct_option_text: correctOption?.body ?? null, // this is the string the frontend displays as "Correct answer: ___"
			message,
		})
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})

export default router
