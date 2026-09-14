/**
 * Player profile — points, achievements, daily streaks.
 *
 * Every value returned here is derived from data that already exists
 * (users.points, trivia_attempts, user_cards), so there is no separate
 * achievement or streak table to keep in sync. Streak and achievement
 * conditions are recomputed on each request.
 */

import express from "express";
import pool from "../utils/db.js";

const router = express.Router();

// Same auth pattern used by routes/trivia.js and routes/sync.js — the
// bridge middleware in server.js populates req.user / req.session.user
// for both PIN-auth and Better Auth (Google) sessions.
function requireAuth(req, res, next) {
    const userId = req.session?.user?.user_id || req.user?.user_id;
    if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
    }
    req.userId = userId;
    next();
}

// ── Date helpers (server-local, matching how MySQL stores DATETIME) ─────
function localDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function shiftDate(isoDate, deltaDays) {
    const [y, m, d] = isoDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + deltaDays);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
}

// ── Streak computation ──────────────────────────────────────────────────
// A "streak day" is any calendar day on which the player logged at least
// one trivia attempt. The current streak stays alive if the most recent
// active day is today or yesterday — so a player who played yesterday but
// hasn't played yet today still sees their streak intact. If the most
// recent active day is older than yesterday, the streak has lapsed.
async function computeStreak(userId) {
    const [rows] = await pool.query(
        `SELECT DATE_FORMAT(attempted_at, '%Y-%m-%d') AS day
		 FROM trivia_attempts
		 WHERE user_id = ?
		 GROUP BY day
		 ORDER BY day DESC`,
        [userId],
    );

    if (!rows.length) {
        return {
            current: 0,
            longest: 0,
            lastActiveDate: null,
            activeToday: false,
        };
    }

    const days = rows.map((r) => r.day); // descending
    const today = localDateString();
    const yesterday = shiftDate(today, -1);

    // Current streak: count backwards only if the latest day is today/yesterday.
    let current = 0;
    if (days[0] === today || days[0] === yesterday) {
        current = 1;
        let prev = days[0];
        for (let i = 1; i < days.length; i++) {
            if (days[i] === shiftDate(prev, -1)) {
                current++;
                prev = days[i];
            } else {
                break;
            }
        }
    }

    // Longest streak: scan ascending and track the longest consecutive run.
    const ascending = [...days].reverse();
    let longest = 0;
    let run = 0;
    let prevDay = null;
    for (const day of ascending) {
        if (prevDay === null || day !== shiftDate(prevDay, 1)) {
            run = 1;
        } else {
            run++;
        }
        if (run > longest) longest = run;
        prevDay = day;
    }

    return {
        current,
        longest,
        lastActiveDate: days[0],
        activeToday: days[0] === today,
    };
}

// ── Achievement evaluation ──────────────────────────────────────────────
async function computeAchievements(userId) {
    const [[cardRow]] = await pool.query(
        "SELECT COUNT(*) AS n FROM user_cards WHERE user_id = ?",
        [userId],
    );
    const [[eventRow]] = await pool.query(
        "SELECT COUNT(DISTINCT event_id) AS n FROM trivia_attempts WHERE user_id = ?",
        [userId],
    );
    const [[correctRow]] = await pool.query(
        "SELECT COUNT(*) AS n FROM trivia_attempts WHERE user_id = ? AND is_correct = 1",
        [userId],
    );
    const [[pointsRow]] = await pool.query(
        "SELECT points FROM users WHERE user_id = ?",
        [userId],
    );
    const streak = await computeStreak(userId);

    const points = pointsRow?.points ?? 0;

    return [
        {
            key: "first_card",
            name: "First Card",
            description: "Earn your first card from any event.",
            unlocked: cardRow.n >= 1,
        },
        {
            key: "explorer_5",
            name: "Explorer",
            description: "Attempt challenges at 5 different events.",
            unlocked: eventRow.n >= 5,
        },
        {
            key: "scholar_10",
            name: "Scholar",
            description: "Answer 10 trivia questions correctly.",
            unlocked: correctRow.n >= 10,
        },
        {
            key: "streak_3",
            name: "Three-Day Streak",
            description: "Play on three consecutive days.",
            unlocked: streak.longest >= 3,
        },
        {
            key: "centurion",
            name: "Centurion",
            description: "Accumulate 100 points.",
            unlocked: points >= 100,
        },
    ];
}

// ── Route ───────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.userId;

        const [[user]] = await pool.query(
            "SELECT user_id, name, email, points FROM users WHERE user_id = ?",
            [userId],
        );
        if (!user) return res.status(404).json({ error: "User not found" });

        const [streak, achievements] = await Promise.all([
            computeStreak(userId),
            computeAchievements(userId),
        ]);

        res.json({
            user: {
                id: user.user_id,
                name: user.name,
                email: user.email,
            },
            points: user.points,
            streak,
            achievements,
        });
    } catch (err) {
        console.error("Profile fetch error:", err);
        res.status(500).json({ error: "Failed to load profile" });
    }
});

export default router;
