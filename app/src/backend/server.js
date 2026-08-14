import express from "express";
import pool from "./db.js";

const app = express();

app.use(express.json());

app.get("/api/health", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SHOW TABLES"
        );

        res.json({
            success: true,
            tables: rows
        });
    } catch (error) {
        console.error("Database connection failed:", error);

        res.status(500).json({
            success: false,
            database: false
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Wits Quest backend running on port ${PORT}`);
});