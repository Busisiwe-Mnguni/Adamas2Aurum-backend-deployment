import { jest } from '@jest/globals'
jest.unstable_mockModule('../utils/db.js', () => ({
	default: { query: jest.fn() },
}))
const { default: pool } = await import('../utils/db.js')
const { default: analyticsRouter } = await import('./analytics.js')
import express from 'express'
import { createServer } from 'http'

function makeApp(sessionUser = { user_id: 1 }) {
	const session = sessionUser ? { user: sessionUser } : {}
	const app = express()
	app.use(express.json())
	app.use((req, _res, next) => {
		req.session = session
		req.user = sessionUser
		next()
	})
	app.use('/api/analytics', analyticsRouter)
	return app
}
async function withServer(app, fn) {
	const server = createServer(app)
	await new Promise((r) => server.listen(0, '127.0.0.1', r))
	const { port } = server.address()
	try {
		await fn(`http://127.0.0.1:${port}`)
	} finally {
		await new Promise((r) => server.close(r))
	}
}

describe('GET /api/analytics/questions/hard', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no session', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/questions/hard`
			)
			expect(res.status).toBe(401)
		})
	})
	test('403 when not author', async () => {
		pool.query.mockResolvedValueOnce([[]])
		const app = makeApp({ user_id: 2 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/questions/hard`
			)
			expect(res.status).toBe(403)
		})
	})
	test('200 returns hard questions with options', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([
				[
					{
						id: 1,
						event_id: 1,
						type: 'MULTIPLE_CHOICE',
						text: 'Q?',
						event_title: 'E',
						attempts: '10',
						wrong: '8',
						correct: '2',
						failure_rate: '0.8',
					},
				],
			]) // main query
			.mockResolvedValueOnce([
				[
					{
						option_id: 1,
						body: 'A',
						is_correct: 1,
					},
					{
						option_id: 2,
						body: 'B',
						is_correct: 0,
					},
				],
			]) // options for q1
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/questions/hard?threshold=0.6&min_attempts=5`
			)
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body).toHaveLength(1)
			expect(body[0].failure_rate).toBe(0.8)
			expect(body[0].options).toHaveLength(2)
		})
	})
	test('empty when no hard questions', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([[]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/questions/hard`
			)
			expect(res.status).toBe(200)
			expect(await res.json()).toEqual([])
		})
	})
})

describe('GET /api/analytics/events/stale', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no session', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/events/stale`
			)
			expect(res.status).toBe(401)
		})
	})
	test('200 returns stale list', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([
				[
					{
						event_id: 1,
						title: 'Old',
						curation_status: 'PUBLISHED',
						days_since_end: 45,
					},
				],
			])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/events/stale?days=30`
			)
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body[0].event_id).toBe(1)
		})
	})
})

describe('GET /api/analytics/overview', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no session', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/overview`
			)
			expect(res.status).toBe(401)
		})
	})
	test('200 overview', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([
				[
					{ status: 'PUBLISHED', count: 5 },
					{ status: 'DRAFT', count: 2 },
				],
			]) // statusCounts
			.mockResolvedValueOnce([
				[{ status: 'ACTIVE', count: 1 }],
			]) // campaignCounts
			.mockResolvedValueOnce([[{ hard_questions: 3 }]]) // hard
			.mockResolvedValueOnce([[{ stale: 1 }]]) // stale
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/analytics/overview`
			)
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.hard_questions).toBe(3)
			expect(body.stale_events).toBe(1)
			expect(body.statusCounts).toHaveLength(2)
		})
	})
})
