import express from "express";
import crypto from "crypto";
import pool from "../utils/db.js";

const router = express.Router();

function hashPin(pin) {
    return crypto
        .createHash("sha256")
        .update(String(pin))
        .digest("hex")
        .toLowerCase();
}

router.use((req, res, next) => {
    console.log(
        `[Auth Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`,
    );
    next();
});

// LOGIN ROUTE
router.post("/login", async (req, res) => {
    const { email, pin, password } = req.body;
    const inputPin = pin || password; // accepts pin or password field from frontend
    const userEmail = email ? email.trim().toLowerCase() : "";

    if (!userEmail || !inputPin) {
        return res.status(400).json({ error: "email and pin are required" });
    }

    try {
        const [users] = await pool.query(
            "SELECT user_id, name, email FROM users WHERE LOWER(email) = ?",
            [userEmail],
        );

        if (!users.length) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = users[0];

        const [creds] = await pool.query(
            "SELECT pin_hash FROM user_credentials WHERE user_id = ?",
            [user.user_id],
        );

        if (
            !creds.length ||
            creds[0].pin_hash.toLowerCase() !== hashPin(inputPin)
        ) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // Store session
        req.session.user = {
            user_id: user.user_id,
            name: user.name,
            email: user.email,
        };

        const [roleRows] = await pool.query(
            "SELECT role FROM admin_roles WHERE user_id = ?",
            [user.user_id],
        );

        res.json({
            message: "Logged in",
            user: {
                ...req.session.user,
                roles: roleRows.map((r) => r.role),
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// REGISTER ROUTE
router.post("/register", async (req, res) => {
    const { name, email, password, pin } = req.body;
    const inputPin = pin || password;
    const userEmail = email ? email.trim().toLowerCase() : "";

    if (!name || !userEmail || !inputPin) {
        return res.status(400).json({
            error: "name, email, and password/pin are required",
        });
    }

    try {
        const [existing] = await pool.query(
            "SELECT user_id FROM users WHERE LOWER(email) = ?",
            [userEmail],
        );

        if (existing.length > 0) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const provider_id = `local:${userEmail}`;
        const [result] = await pool.query(
            "INSERT INTO users (provider_id, email, name, points) VALUES (?, ?, ?, 0)",
            [provider_id, userEmail, name.trim()],
        );

        const userId = result.insertId;
        const hashedPin = hashPin(inputPin);

        await pool.query(
            "INSERT INTO user_credentials (user_id, pin_hash) VALUES (?, ?)",
            [userId, hashedPin],
        );

        req.session.user = {
            user_id: userId,
            name: name.trim(),
            email: userEmail,
        };

        const [roleRows] = await pool.query(
            "SELECT role FROM admin_roles WHERE user_id = ?",
            [userId],
        );

        res.status(201).json({
            message: "Account created successfully",
            user: {
                ...req.session.user,
                roles: roleRows.map((r) => r.role),
            },
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// SESSION CHECK ROUTE
router.get("/me", async (req, res) => {
    if (!req.session?.user?.user_id) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const { user_id, name, email } = req.session.user;

    try {
        const [rows] = await pool.query(
            "SELECT role FROM admin_roles WHERE user_id = ?",
            [user_id],
        );

        res.json({
            user_id,
            name,
            email,
            roles: rows.map((r) => r.role),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// LOGOUT ROUTE
router.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ message: "Logged out" });
    });
});

export default router;
