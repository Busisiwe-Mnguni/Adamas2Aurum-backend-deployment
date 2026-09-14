import express from "express";

import pool from "../utils/db.js";
import { error, success } from "../utils/response.js";

const router = express.Router();

/**
 * Normalize an incoming datetime to a UTC 'YYYY-MM-DD HH:MM:SS' string
 * for DATETIME storage. The console sends UTC ISO strings; naive
 * 'YYYY-MM-DDTHH:MM' wall times (old clients, manual API use) are read
 * as server-local. Returns null for empty/invalid input.
 * DATETIME columns carry no zone, so everything must be UTC — the
 * public window filter compares against UTC_TIMESTAMP().
 */
function toUtcDatetime(value) {
	if (value == null || value === '') return null
	const d = new Date(value)
	if (isNaN(d)) return null
	const p = (n) => String(n).padStart(2, '0')
	return (
		`${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
		` ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
	)
}

router.use((req, res, next) => {
    console.log(
        `[Events Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`,
    );
    next();
});

function requireAuth(req, res, next) {
    const userId = req.session?.user?.user_id || req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "Unauthorised — please log in" });
    }
    if (!req.user) {
        req.user = req.session.user;
    }
    next();
}

/**
 * Ensure the authenticated user holds at least one authoring role.
 * FIXED: converted callback-style pool.query -> async/await so the
 * middleware actually calls next() instead of hanging forever.
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
            req.user.user_id,
            ...allowedRoles,
        ]);
        if (!rows.length) {
            return res.status(403).json({
                error: "Forbidden — event author role required",
            });
        }
        next();
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}

router.get("/", async (req, res) => {
    try {
        // Author-only: return every event (including inactive / future) for management
        if (req.query.all === "true") {
            const userId = req.session?.user?.user_id || req.user?.user_id;
            if (!userId) {
                return res.status(401).json({
                    error: "Unauthorised — please log in",
                });
            }

            const [roles] = await pool.query(
                `SELECT 1 FROM admin_roles 
				 WHERE user_id = ? AND role IN (?, ?) 
				 LIMIT 1`,
                [userId, "SUPER_ADMIN", "EVENT_AUTHOR"],
            );

            if (!roles.length) {
                return res.status(403).json({
                    error: "Forbidden — event author access required",
                });
            }

            const [results] = await pool.query(
                "SELECT * FROM events ORDER BY created_at DESC",
            );
            return res.json(results);
        }

<<<<<<< HEAD
        // Public: only events that are active AND inside their time window
        const [results] = await pool.query(
            `SELECT * FROM events 
			 WHERE is_active = TRUE 
			   AND (starts_at IS NULL OR starts_at <= NOW()) 
			   AND (ends_at IS NULL OR ends_at >= NOW())`,
        );
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
=======
		// Public: only events that are active AND inside their time window.
		// Windows are stored as UTC, so compare against UTC_TIMESTAMP()
		// (NOW() follows the DB host clock, which may not be UTC).
		const [results] = await pool.query(
			`SELECT * FROM events 
			 WHERE is_active = TRUE 
			   AND (starts_at IS NULL OR starts_at <= UTC_TIMESTAMP()) 
			   AND (ends_at IS NULL OR ends_at >= UTC_TIMESTAMP())`
		)
		res.json(results)
	} catch (err) {
		res.status(500).json({ error: err.message })
	}
})
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

router.get("/:id", async (req, res) => {
    try {
        const [results] = await pool.query(
            "SELECT * FROM events WHERE event_id = ?",
            [req.params.id],
        );
        if (!results.length) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json(results[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

<<<<<<< HEAD
router.post("/", requireAuth, requireEventAuthor, async (req, res) => {
    const {
        title,
        description,
        latitude,
        longitude,
        radius_meters,
        point_threshold,
        point_reward,
        starts_at,
        ends_at,
        repeat_interval,
        attempt_cooldown_s,
        max_attempts_per_window,
    } = req.body;
=======
router.post('/', requireAuth, requireEventAuthor, async (req, res) => {
	const {
		title,
		description,
		latitude,
		longitude,
		radius_meters,
		point_threshold,
		point_reward,
		starts_at,
		ends_at,
		repeat_interval,
		attempt_cooldown_s,
		max_attempts_per_window,
		is_active,
	} = req.body
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

    if (!title || latitude == null || longitude == null || !radius_meters) {
        return res.status(400).json({
            error: "title, latitude, longitude and radius_meters are required",
        });
    }

    const sql = `
    INSERT INTO events (
      title, description,
      latitude, longitude, radius_meters,
      point_threshold, point_reward,
      starts_at, ends_at,
      repeat_interval, attempt_cooldown_s, max_attempts_per_window,
      is_active, author_id
<<<<<<< HEAD
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
  `;

    const values = [
        title,
        description ?? null,
        latitude,
        longitude,
        radius_meters,
        point_threshold ?? 0,
        point_reward ?? 10,
        starts_at ?? null,
        ends_at ?? null,
        repeat_interval ?? null,
        attempt_cooldown_s ?? 86400,
        max_attempts_per_window ?? 1,
        req.user.user_id,
    ];
=======
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `

	const values = [
		title,
		description ?? null,
		latitude,
		longitude,
		radius_meters,
		point_threshold ?? 0,
		point_reward ?? 10,
		toUtcDatetime(starts_at),
		toUtcDatetime(ends_at),
		repeat_interval ?? null,
		attempt_cooldown_s ?? 86400,
		max_attempts_per_window ?? 1,
		is_active ?? true,
		req.user.user_id,
	]
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

    try {
        const [result] = await pool.query(sql, values);
        res.status(201).json({
            message: "Event created",
            event_id: result.insertId,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put("/:id", requireAuth, requireEventAuthor, async (req, res) => {
    const {
        title,
        description,
        latitude,
        longitude,
        radius_meters,
        point_threshold,
        point_reward,
        starts_at,
        ends_at,
        repeat_interval,
        attempt_cooldown_s,
        max_attempts_per_window,
        is_active,
    } = req.body;

    const sql = `
    UPDATE events
    SET
      title                   = ?,
      description             = ?,
      latitude                = ?,
      longitude               = ?,
      radius_meters           = ?,
      point_threshold         = ?,
      point_reward            = ?,
      starts_at               = ?,
      ends_at                 = ?,
      repeat_interval         = ?,
      attempt_cooldown_s      = ?,
      max_attempts_per_window = ?,
      is_active               = ?
    WHERE event_id = ?
  `;

<<<<<<< HEAD
    const values = [
        title,
        description ?? null,
        latitude,
        longitude,
        radius_meters,
        point_threshold ?? 0,
        point_reward ?? 10,
        starts_at ?? null,
        ends_at ?? null,
        repeat_interval ?? null,
        attempt_cooldown_s ?? 86400,
        max_attempts_per_window ?? 1,
        is_active ?? true,
        req.params.id,
    ];
=======
	const values = [
		title,
		description ?? null,
		latitude,
		longitude,
		radius_meters,
		point_threshold ?? 0,
		point_reward ?? 10,
		toUtcDatetime(starts_at),
		toUtcDatetime(ends_at),
		repeat_interval ?? null,
		attempt_cooldown_s ?? 86400,
		max_attempts_per_window ?? 1,
		is_active ?? true,
		req.params.id,
	]
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

    try {
        const [result] = await pool.query(sql, values);
        if (!result.affectedRows) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json({ message: "Event updated" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", requireAuth, requireEventAuthor, async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM events WHERE event_id = ?",
            [req.params.id],
        );
        if (!result.affectedRows) {
            return res.status(404).json({ error: "Event not found" });
        }
        res.json({ message: "Event deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
