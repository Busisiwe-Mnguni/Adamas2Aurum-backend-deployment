import { jest } from '@jest/globals'
jest.unstable_mockModule('../utils/db.js', () => ({
	default: { query: jest.fn() },
}))
const { default: pool } = await import('../utils/db.js')
const { default: campaignsRouter } = await import('./campaigns.js')
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
	app.use('/api/campaigns', campaignsRouter)
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

describe('GET /api/campaigns', () => {
	beforeEach(() => pool.query.mockReset())
	test('public returns SCHEDULED|ACTIVE inside window', async () => {
		pool.query.mockResolvedValueOnce([
			[{ campaign_id: 1, name: 'T1' }],
		])
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`)
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body[0].name).toBe('T1')
		})
		expect(pool.query.mock.calls[0][0]).toMatch(/SCHEDULED/)
	})
	test('GET ?all=true requires auth', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/campaigns?all=true`
			)
			expect(res.status).toBe(401)
		})
	})
	test('GET ?all=true forbids non-author', async () => {
		pool.query.mockResolvedValueOnce([[]]) // roles empty
		const app = makeApp({ user_id: 2 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/campaigns?all=true`
			)
			expect(res.status).toBe(403)
		})
	})
})

describe('POST /api/campaigns', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no session', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'X' }),
			})
			expect(res.status).toBe(401)
		})
	})
	test('403 when not author', async () => {
		pool.query.mockResolvedValueOnce([[]])
		const app = makeApp({ user_id: 2 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'X' }),
			})
			expect(res.status).toBe(403)
		})
	})
	test('400 when name missing', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('201 creates campaign', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([{ insertId: 5 }]) // insert
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Term 1',
					term: '2026 T1',
					is_open_day: true,
					open_day_label: 'Open Day',
				}),
			})
			expect(res.status).toBe(201)
			const body = await res.json()
			expect(body.campaign_id).toBe(5)
		})
	})
	test('400 for invalid status', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'X',
					status: 'BAD',
				}),
			})
			expect(res.status).toBe(400)
		})
	})
})

describe('PUT /api/campaigns/:id', () => {
	beforeEach(() => pool.query.mockReset())
	test('404 when not found', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([[]]) // select
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns/999`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New' }),
			})
			expect(res.status).toBe(404)
		})
	})
	test('200 updates', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([[{ campaign_id: 1 }]]) // exists
			.mockResolvedValueOnce([{ affectedRows: 1 }]) // update
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns/1`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Updated',
					status: 'SCHEDULED',
				}),
			})
			expect(res.status).toBe(200)
		})
	})
})

describe('DELETE /api/campaigns/:id', () => {
	beforeEach(() => pool.query.mockReset())
	test('deletes and unlinks events', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([{ affectedRows: 2 }]) // UPDATE events SET campaign_id NULL
			.mockResolvedValueOnce([{ affectedRows: 1 }]) // DELETE campaign
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/campaigns/1`, {
				method: 'DELETE',
			})
			expect(res.status).toBe(200)
		})
	})
})

describe('POST /api/campaigns/:id/events', () => {
	beforeEach(() => pool.query.mockReset())
	test('400 when event_ids missing', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/campaigns/1/events`,
				{
					method: 'POST',
					headers: {
						'Content-Type':
							'application/json',
					},
					body: JSON.stringify({}),
				}
			)
			expect(res.status).toBe(400)
		})
	})
	test('200 links events', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([[{ campaign_id: 1 }]]) // exists
			.mockResolvedValueOnce([{ affectedRows: 2 }]) // update events
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/campaigns/1/events`,
				{
					method: 'POST',
					headers: {
						'Content-Type':
							'application/json',
					},
					body: JSON.stringify({
						event_ids: [1, 2],
					}),
				}
			)
			expect(res.status).toBe(200)
		})
	})
})
