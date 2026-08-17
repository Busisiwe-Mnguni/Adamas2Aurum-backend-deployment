/**
 * Adamas2Aurum - Express Server
 *
 * Entry point for the Adamas2Aurum application.
 * Mounts Better Auth handler BEFORE express.json() as required by docs.
 * Serves static files from app/src/frontend.
 */

import 'dotenv/config'
import express from 'express'
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node'
import { auth } from './better-auth.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const app = express()
const PORT = process.env.PORT || 3000

// ---------------------------------------------------------------------------
// 1. Better Auth handler — MUST be mounted BEFORE express.json()
//    Catches all requests to /api/auth/*
// ---------------------------------------------------------------------------
app.all('/api/auth/*', toNodeHandler(auth))

// ---------------------------------------------------------------------------
// 2. JSON body parser (after Better Auth handler)
// ---------------------------------------------------------------------------
app.use(express.json())

// ---------------------------------------------------------------------------
// 3. Static files (HTML, CSS, vanilla JS)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, '../frontend')))

// ---------------------------------------------------------------------------
// 4. Protected API route — get current session (for the dashboard)
// ---------------------------------------------------------------------------
app.get('/api/me', async (req, res) => {
	try {
		const session = await auth.api.getSession({
			headers: fromNodeHeaders(req.headers),
		})
		res.json(session)
	} catch (err) {
		res.status(500).json({ error: 'Failed to get session' })
	}
})

// ---------------------------------------------------------------------------
// 5. Fallback — serve sign-in.html for root
// ---------------------------------------------------------------------------
app.get('/', (_req, res) => {
	res.sendFile(
		path.join(__dirname, '../frontend', 'pages', 'sign-in.html')
	)
})

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
	console.log(`Adamas2Aurum server running at http://localhost:${PORT}`)
	console.log(`Health check: http://localhost:${PORT}/api/auth/ok`)
})
