import express from 'express'
import pool from '../utils/db.js'

const router = express.Router()

function requireAuth(req, res, next) {
  if (!req.session?.user?.user_id) {
    return res.status(401).json({ error: 'Unauthorised — please log in' })
  }
  next()
}

/**
 * GET TRIVIA QUESTION FOR AN EVENT
 * Now requires auth: previously this endpoint allowed anyone (logged in
 * or not) to fetch a trivia question, which meant the frontend's "must
 * log in to attempt a challenge" rule was cosmetic only — it could be
 * bypassed by calling this route directly.
 */
router.get('/event/:eventId', requireAuth, async (req, res) => {
  try {
    const { eventId } = req.params

    const [questions] = await pool.query(
      `SELECT question_id, format, body, time_limit_s, difficulty 
       FROM trivia_questions 
       WHERE event_id = ? 
       ORDER BY RAND() LIMIT 1`,
      [eventId]
    )

    if (!questions.length) {
      return res.status(404).json({ error: 'No active trivia questions found for this location.' })
    }

    const question = questions[0]

    const [options] = await pool.query(
      `SELECT option_id, body FROM trivia_options WHERE question_id = ?`,
      [question.question_id]
    )

    res.json({
      question_id: question.question_id,
      body: question.body,
      format: question.format,
      time_limit_s: question.time_limit_s,
      options: options,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

/**
 * SUBMIT TRIVIA ANSWER & AWARD POINTS
 */
router.post('/submit', requireAuth, async (req, res) => {
  const { event_id, question_id, selected_option_id, answer_time_ms } = req.body
  const user_id = req.session.user.user_id

  if (!question_id || !selected_option_id) {
    return res.status(400).json({ error: 'question_id and selected_option_id are required' })
  }

  try {
    const [options] = await pool.query(
      `SELECT is_correct FROM trivia_options WHERE option_id = ? AND question_id = ?`,
      [selected_option_id, question_id]
    )

    if (!options.length) {
      return res.status(404).json({ error: 'Invalid option selected' })
    }

    const isCorrect = Boolean(options[0].is_correct)

    const [events] = await pool.query(
      `SELECT point_reward FROM events WHERE event_id = ?`,
      [event_id]
    )
    const pointsAwarded = isCorrect ? (events[0]?.point_reward || 10) : 0

    const [locCheck] = await pool.query(
      `INSERT INTO location_check_log (user_id, event_id, claimed_lat, claimed_lng, distance_meters, status) 
       VALUES (?, ?, 0, 0, 0, 'VERIFIED')`,
      [user_id, event_id]
    )

    await pool.query(
      `INSERT INTO trivia_attempts (user_id, event_id, question_id, location_check_id, is_correct, answer_time_ms, points_awarded)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, event_id, question_id, locCheck.insertId, isCorrect, answer_time_ms || 0, pointsAwarded]
    )

    if (isCorrect && pointsAwarded > 0) {
      await pool.query(`UPDATE users SET points = points + ? WHERE user_id = ?`, [pointsAwarded, user_id])
      await pool.query(
        `INSERT INTO point_transactions (user_id, delta, reason, reference_id) VALUES (?, ?, 'TRIVIA_WIN', ?)`,
        [user_id, pointsAwarded, event_id]
      )
    }

    res.json({
      success: true,
      is_correct: isCorrect,
      points_awarded: pointsAwarded,
      message: isCorrect ? `Correct! You earned ${pointsAwarded} points.` : 'Incorrect answer. Try again later!',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router