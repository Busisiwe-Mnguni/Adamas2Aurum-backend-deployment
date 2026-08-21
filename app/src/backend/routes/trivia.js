import express from 'express'
import pool from '../utils/db.js'

const router = express.Router()

// Blocks access to a route unless the player has an active login session.
// req.session.user is set by the /auth/login route when someone logs in
// successfully (see routes/auth.js) — express-session keeps that tied to
// a cookie in the browser, so this check runs on every protected request.
function requireAuth(req, res, next) {
  if (!req.session?.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorised — please log in' })
  }
  next()
}

/**
 * GET TRIVIA QUESTION FOR AN EVENT
 *
 * Called when a player clicks "Attempt Challenge" on a map pin. Picks one
 * random question tied to that event, then fetches its answer options.
 *
 * IMPORTANT: this only sends back option_id and body (the text shown on
 * each button) — it deliberately does NOT include the is_correct column.
 * If it did, a player could open their browser's Network tab and read the
 * answer straight off the API response before even attempting the
 * question. Keeping correctness server-side-only is what makes the whole
 * quiz trustworthy.
 */
router.get('/event/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params

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
      return res.status(404).json({ error: 'No active trivia questions found for this location.' })
    }

    const question = questions[0]

    // Fetch every answer choice for that specific question. Note: no
    // is_correct here, see comment above the route.
    const [options] = await pool.query(
      `SELECT option_id, body FROM trivia_options WHERE question_id = ?`,
      [question.question_id]
    )

    res.json({
      question_id: question.question_id,
      body: question.body,           // the actual question text
      format: question.format,       // e.g. MULTIPLE_CHOICE, TRUE_FALSE
      time_limit_s: question.time_limit_s,
      options: options,              // array of { option_id, body }
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
 * User story 7: "As a player, when I open a challenge I'm at, I'm shown a
 * question and my answer is checked by the server — and I see the correct
 * answer afterward regardless of whether I got it right." The
 * correct_option_text field added below is what satisfies the second half
 * of that story.
 */
router.post('/submit', requireAuth, async (req, res) => {
  const { event_id, question_id, selected_option_id, answer_time_ms } = req.body
  const user_id = req.session.user.user_id  // comes from the session cookie, not the request body — a player can't spoof this to submit as someone else

  if (!question_id || !selected_option_id) {
    return res.status(400).json({ error: 'question_id and selected_option_id are required' })
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
      return res.status(404).json({ error: 'Invalid option selected' })
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

    // STEP 3: Work out how many points this is worth, from the event's
    // configured point_reward. Wrong answers always award 0 regardless
    // of the event's reward value.
    const [events] = await pool.query(
      `SELECT point_reward FROM events WHERE event_id = ?`,
      [event_id]
    )
    const pointsAwarded = isCorrect ? (events[0]?.point_reward || 10) : 0

    // STEP 4: Log a location check row. NOTE: this currently hardcodes
    // claimed_lat/lng/distance to 0 and marks it 'VERIFIED' unconditionally
    // — the actual geofencing/anti-cheat check (comparing the player's
    // real GPS position to the event's location) isn't implemented yet.
    // This is a known gap, not something this user-story change touches.
    const [locCheck] = await pool.query(
      `INSERT INTO location_check_log (user_id, event_id, claimed_lat, claimed_lng, distance_meters, status) 
       VALUES (?, ?, 0, 0, 0, 'VERIFIED')`,
      [user_id, event_id]
    )

    // STEP 5: Record the attempt itself — this is what user story 8
    // ("first correct answer gets the card, retries don't") will later
    // query against to check "has this user already answered this event
    // correctly before?"
    await pool.query(
      `INSERT INTO trivia_attempts (user_id, event_id, question_id, location_check_id, is_correct, answer_time_ms, points_awarded)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, event_id, question_id, locCheck.insertId, isCorrect, answer_time_ms || 0, pointsAwarded]
    )

    // STEP 6: Only touch the points ledger if the answer was actually
    // correct AND worth something — avoids a redundant 0-point UPDATE.
    if (isCorrect && pointsAwarded > 0) {
      await pool.query(`UPDATE users SET points = points + ? WHERE user_id = ?`, [pointsAwarded, user_id])
      await pool.query(
        `INSERT INTO point_transactions (user_id, delta, reason, reference_id) VALUES (?, ?, 'TRIVIA_WIN', ?)`,
        [user_id, pointsAwarded, event_id]
      )
    }

    // STEP 7: Send everything the frontend needs to render the result —
    // including the correct answer's text, always, whether or not the
    // player's own pick was right.
    res.json({
      success: true,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      correct_option_id: correctOption?.option_id ?? null,   // optional chaining + nullish coalescing: safely handles the case where correctOption is null
      correct_option_text: correctOption?.body ?? null,      // this is the string the frontend displays as "Correct answer: ___"
      message: isCorrect ? `Correct! You earned ${pointsAwarded} points.` : 'Incorrect answer. Try again later!',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router