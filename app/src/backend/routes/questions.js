import express from "express";

import pool from "../utils/db.js";
import { error, success } from "../utils/response.js";

const router = express.Router();

router.use((req, res, next) => {
    console.log(
        `[Questions Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`,
    );
    next();
});

// Blocks access unless the caller has an active login session. NOTE: this
// reads req.session.user (set by the PIN /login route and the Better-Auth
// bridge middleware in server.js) rather than req.user — the events router
// checks req.user, which no current middleware ever populates, so its
// author-gated routes are effectively unreachable. questions.js follows the
// working pattern used by routes/trivia.js so these routes are functional
// and testable. (Not fixing events.js here — out of scope for this story.)
function requireAuth(req, res, next) {
    if (!req.session?.user?.user_id) {
        return res.status(401).json({ error: "Unauthorised — please log in" });
    }
    next();
}

/**
 * Ensure the authenticated user holds an authoring role. Mirrors the
 * requireEventAuthor guard in routes/events.js (it is not exported from
 * there, and events.js must not be modified, so the logic is duplicated
 * here against the same admin_roles table).
 */
async function requireEventAuthor(req, res, next) {
    const allowedRoles = ["SUPER_ADMIN", "EVENT_AUTHOR"];
    const placeholders = allowedRoles.map(() => "?").join(", ");

    const sql = `
    SELECT 1 FROM admin_roles
    WHERE user_id = ?
      AND role IN (${placeholders})
    LIMIT 1
  `;

    try {
        const [rows] = await pool.query(sql, [
            req.session.user.user_id,
            ...allowedRoles,
        ]);
        if (!rows.length) {
            return res.status(403).json({
                error: "Forbidden — event author role required",
            });
        }
        next();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

const QUESTION_TYPES = ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK"];

/**
 * Validate a question payload. Returns an error string on failure, or null
 * when the payload is valid.
 *
 * - MULTIPLE_CHOICE: options must be a non-empty array and correctAnswer
 *   must be one of those option strings.
 * - TRUE_FALSE: correctAnswer must be "true" or "false".
 * - FILL_BLANK: correctAnswer is the expected answer text (options ignored).
 */
function validateQuestion({ type, text, correctAnswer, options }) {
    if (!QUESTION_TYPES.includes(type)) {
        return "type must be one of MULTIPLE_CHOICE, TRUE_FALSE, FILL_BLANK";
    }
    if (!text || !String(text).trim()) {
        return "text is required";
    }
    if (correctAnswer == null || !String(correctAnswer).trim()) {
        return "correctAnswer is required";
    }

    if (type === "MULTIPLE_CHOICE") {
        if (!Array.isArray(options) || options.length === 0) {
            return "options must be a non-empty array for MULTIPLE_CHOICE";
        }
        if (!options.some((opt) => String(opt) === String(correctAnswer))) {
            return "correctAnswer must be one of the provided options";
        }
    }

    if (type === "TRUE_FALSE") {
        const ca = String(correctAnswer).toLowerCase();
        if (ca !== "true" && ca !== "false") {
            return 'correctAnswer must be "true" or "false" for TRUE_FALSE';
        }
    }

    return null;
}

/**
 * GET /events/:eventId/questions — list questions for an event.
 *
 * Public read. DELIBERATELY omits correct_answer so players (or anyone
 * hitting this endpoint) cannot see the answers. Only Story 7's
 * answer-check/reveal flow is allowed to surface the correct answer.
 */
router.get("/events/:eventId/questions", async (req, res) => {
    try {
        const [results] = await pool.query(
            `SELECT id, event_id, type, text, options, created_at, updated_at
		     FROM questions
		     WHERE event_id = ?
		     ORDER BY created_at ASC`,
            [req.params.eventId],
        );
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /events/:eventId/questions — create a question (author-only).
 */
router.post(
    "/events/:eventId/questions",
    requireAuth,
    requireEventAuthor,
    async (req, res) => {
        const { type, text, correctAnswer, options } = req.body;

        const validationError = validateQuestion({
            type,
            text,
            correctAnswer,
            options,
        });
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        try {
            // Confirm the event exists before attaching a question to it.
            const [events] = await pool.query(
                "SELECT event_id FROM events WHERE event_id = ?",
                [req.params.eventId],
            );
            if (!events.length) {
                return res.status(404).json({ error: "Event not found" });
            }

            // Normalise: TRUE_FALSE stores a lowercase "true"/"false";
            // MULTIPLE_CHOICE stores options as a JSON array; other types
            // store NULL options.
            const normalizedAnswer =
                type === "TRUE_FALSE"
                    ? String(correctAnswer).toLowerCase()
                    : String(correctAnswer);

            const optionsValue =
                type === "MULTIPLE_CHOICE" && Array.isArray(options)
                    ? JSON.stringify(options)
                    : null;

            const [result] = await pool.query(
                `INSERT INTO questions (event_id, type, text, correct_answer, options)
				 VALUES (?, ?, ?, ?, ?)`,
                [
                    req.params.eventId,
                    type,
                    text,
                    normalizedAnswer,
                    optionsValue,
                ],
            );

            res.status(201).json({
                message: "Question created",
                id: result.insertId,
            });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
);

/**
 * PUT /questions/:id — edit a question (author-only), same validation rules.
 */
router.put(
    "/questions/:id",
    requireAuth,
    requireEventAuthor,
    async (req, res) => {
        const { type, text, correctAnswer, options } = req.body;

        const validationError = validateQuestion({
            type,
            text,
            correctAnswer,
            options,
        });
        if (validationError) {
            return res.status(400).json({ error: validationError });
        }

        try {
            const [existing] = await pool.query(
                "SELECT id FROM questions WHERE id = ?",
                [req.params.id],
            );
            if (!existing.length) {
                return res.status(404).json({ error: "Question not found" });
            }

            const normalizedAnswer =
                type === "TRUE_FALSE"
                    ? String(correctAnswer).toLowerCase()
                    : String(correctAnswer);

            const optionsValue =
                type === "MULTIPLE_CHOICE" && Array.isArray(options)
                    ? JSON.stringify(options)
                    : null;

            const [result] = await pool.query(
                `UPDATE questions
		     SET type           = ?,
		         text           = ?,
		         correct_answer = ?,
		         options        = ?
		     WHERE id = ?`,
                [type, text, normalizedAnswer, optionsValue, req.params.id],
            );

            if (!result.affectedRows) {
                return res.status(404).json({ error: "Question not found" });
            }
            res.json({ message: "Question updated" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
);

/**
 * DELETE /questions/:id — remove a question (author-only). The FK cascade
 * only fires event->questions; deleting a question row directly is safe.
 */
router.delete(
    "/questions/:id",
    requireAuth,
    requireEventAuthor,
    async (req, res) => {
        try {
            const [result] = await pool.query(
                "DELETE FROM questions WHERE id = ?",
                [req.params.id],
            );
            if (!result.affectedRows) {
                return res.status(404).json({ error: "Question not found" });
            }
            res.json({ message: "Question deleted" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },
);

export default router;
