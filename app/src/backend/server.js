/**
 * Adamas2Aurum - Express Server
 *
 * Entry point for the Adamas2Aurum application.
 * Mounts Better Auth handler BEFORE express.json() as required by docs.
 * Serves static files from /public.
 */

import "./env.js";
import express from "express";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { auth } from "./src/auth.js";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------------------------------------------------------------
// 1. Better Auth handler — MUST be mounted BEFORE express.json()
//    Catches all requests to /api/auth/*
// ---------------------------------------------------------------------------
app.all("/api/auth/*", toNodeHandler(auth));

// ---------------------------------------------------------------------------
// 2. JSON body parser (after Better Auth handler)
// ---------------------------------------------------------------------------
app.use(express.json());

// ---------------------------------------------------------------------------
// 3. Static files (CSS, JS, and bundled client from frontend directories)
// ---------------------------------------------------------------------------
const frontendDir = path.join(__dirname, "..", "frontend");
app.use("/css", express.static(path.join(frontendDir, "css")));
app.use("/js", express.static(path.join(frontendDir, "js")));
app.use(express.static(path.join(frontendDir, "public")));

// ---------------------------------------------------------------------------
// 4. Protected API route — get current session (for the dashboard)
// ---------------------------------------------------------------------------
app.get("/api/me", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: "Failed to get session" });
  }
});

// ---------------------------------------------------------------------------
// 5. HTML pages (served from frontend/pages, not covered by express.static)
// ---------------------------------------------------------------------------
const pagesDir = path.join(frontendDir, "pages");

app.get("/", (_req, res) => {
  res.sendFile(path.join(pagesDir, "index.html"));
});

app.get("/dashboard", (_req, res) => {
  res.sendFile(path.join(pagesDir, "dashboard.html"));
});

app.get("/dashboard.html", (_req, res) => {
  res.sendFile(path.join(pagesDir, "dashboard.html"));
});

app.get("/reset-password.html", (_req, res) => {
  res.sendFile(path.join(pagesDir, "reset-password.html"));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Adamas2Aurum server running at http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/auth/ok`);
});
