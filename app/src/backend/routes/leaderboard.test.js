import { jest } from '@jest/globals'

// Mock the shared pool module BEFORE the router imports it. The router
// only ever calls pool.query(), so a single stub is enough.
jest.unstable_mockModule('../utils/db.js', () => ({
	default: {
		query: jest.fn(),
	},
}))

const { default: pool } = await import('../utils/db.js')
const { default: leaderboard_router } = await import('./leaderboard.js')

// ── Minimal Express harness ─────────────────────────────────
// Rather than pulling in supertest (not in your backend deps), we
// mount the router on a bare Express app, spin up a listener on an
// ephemeral port, and drive it with fetch(). Node 18+ has fetch built
// in, so this needs zero extra dependencies.
import express from 'express'
import { createServer } from 'http'

function makeApp(sessionUser = null) {
	const app = express()
	app.use((req, _res, next) => {
		req.session = sessionUser ? { user: sessionUser } : {}
		next()
	})
	app.use('/api/leaderboard', leaderboard_router)
	return app
}

async function withServer(app, fn) {
	const server = createServer(app)
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	const { port } = server.address()
	try {
		await fn(`http://127.0.0.1:${port}`)
	} finally {
		await new Promise((resolve) => server.close(resolve))
	}
}

// ── Tests ───────────────────────────────────────────────────

describe('GET /api/leaderboard', () => {
	beforeEach(() => {
		pool.query.mockReset()
	})

	test('returns paginated entries with global 1-based rank', async () => {
		// 1st call: COUNT(*) → total
		// 2nd call: the page of rows
		pool.query
			.mockResolvedValueOnce([[{ total: 100 }]])
			.mockResolvedValueOnce([
				[
					{
						user_id: 1,
						name: 'Alice',
						avatar_url: null,
						points: 500,
						wins: 3,
						losses: 1,
					},
					{
						user_id: 2,
						name: 'Bob',
						avatar_url: null,
						points: 400,
						wins: 2,
						losses: 2,
					},
				],
			])

		const app = makeApp()
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/leaderboard`)
			expect(res.status).toBe(200)
			const body = await res.json()

			expect(body.total).toBe(100)
			expect(body.limit).toBe(50)
			expect(body.offset).toBe(0)
			expect(body.entries).toHaveLength(2)
			expect(body.entries[0]).toMatchObject({
				rank: 1,
				name: 'Alice',
				points: 500,
			})
			expect(body.entries[1]).toMatchObject({
				rank: 2,
				name: 'Bob',
				points: 400,
			})
		})
	})

	test('offset shifts the 1-based rank', async () => {
		pool.query
			.mockResolvedValueOnce([[{ total: 100 }]])
			.mockResolvedValueOnce([
				[
					{
						user_id: 51,
						name: 'X',
						avatar_url: null,
						points: 10,
						wins: 0,
						losses: 0,
					},
				],
			])

		const app = makeApp()
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/leaderboard?limit=1&offset=50`
			)
			const body = await res.json()
			expect(body.entries[0].rank).toBe(51)
		})
	})

	test('clamps limit into [1, 100] and offset >= 0', async () => {
		pool.query
			.mockResolvedValueOnce([[{ total: 0 }]])
			.mockResolvedValueOnce([[]])

		const app = makeApp()
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/leaderboard?limit=99999&offset=-5`
			)
			const body = await res.json()
			expect(body.limit).toBe(100)
			expect(body.offset).toBe(0)
		})
	})

	test('falls back to defaults on non-numeric params', async () => {
		pool.query
			.mockResolvedValueOnce([[{ total: 0 }]])
			.mockResolvedValueOnce([[]])

		const app = makeApp()
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/leaderboard?limit=banana&offset=`
			)
			const body = await res.json()
			expect(body.limit).toBe(50)
			expect(body.offset).toBe(0)
		})
	})

	test('is public — no session required', async () => {
		pool.query
			.mockResolvedValueOnce([[{ total: 0 }]])
			.mockResolvedValueOnce([[]])

		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/leaderboard`)
			expect(res.status).toBe(200)
		})
	})
})

describe('GET /api/leaderboard/me', () => {
	beforeEach(() => {
		pool.query.mockReset()
	})

	test('401s when there is no session', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/leaderboard/me`)
			expect(res.status).toBe(401)
		})
		expect(pool.query).not.toHaveBeenCalled()
	})

	test('returns rank, points, total, and neighbours', async () => {
		// 1) fetch me
		pool.query.mockResolvedValueOnce([
			[
				{
					user_id: 42,
					name: 'Me',
					avatar_url: null,
					points: 250,
				},
			],
		])
		// 2) count ahead
		pool.query.mockResolvedValueOnce([[{ ahead: 46 }]])
		// 3) total
		pool.query.mockResolvedValueOnce([[{ total: 100 }]])
		// 4) neighbours window
		pool.query.mockResolvedValueOnce([
			[
				{
					user_id: 40,
					name: 'N1',
					avatar_url: null,
					points: 260,
					wins: 1,
					losses: 0,
				},
				{
					user_id: 42,
					name: 'Me',
					avatar_url: null,
					points: 250,
					wins: 5,
					losses: 3,
				},
				{
					user_id: 43,
					name: 'N2',
					avatar_url: null,
					points: 240,
					wins: 0,
					losses: 1,
				},
			],
		])

		const app = makeApp({ user_id: 42 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/leaderboard/me`)
			expect(res.status).toBe(200)
			const body = await res.json()

			expect(body.rank).toBe(47) // 46 ahead + 1
			expect(body.points).toBe(250)
			expect(body.total_players).toBe(100)
			expect(body.neighbours.length).toBeGreaterThan(0)
		})
	})

	test('404s when the session points at a user that no longer exists', async () => {
		pool.query.mockResolvedValueOnce([[]])

		const app = makeApp({ user_id: 999 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/leaderboard/me`)
			expect(res.status).toBe(404)
		})
	})
})
