import { jest } from '@jest/globals'
jest.unstable_mockModule('../utils/db.js', () => ({
	default: { query: jest.fn() },
}))
const { default: pool } = await import('../utils/db.js')
const { default: poolRouter } = await import('./event_pool.js')
import express from 'express'
import { createServer } from 'http'
function makeApp(user = { user_id: 1 }) {
	const s = user ? { user } : {}
	const app = express()
	app.use(express.json())
	app.use((req, _res, next) => {
		req.session = s
		req.user = user
		next()
	})
	app.use('/api/events', poolRouter)
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

describe('GET /api/events/:eventId/pool', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no auth', async () => {
		const app = makeApp(null)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`)
			expect(res.status).toBe(401)
		})
	})
	test('403 when not author', async () => {
		pool.query.mockResolvedValueOnce([[]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`)
			expect(res.status).toBe(403)
		})
	})
	test('200 returns pool', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]]) // author
			.mockResolvedValueOnce([
				[{ pool_id: 1, event_id: 1, card_id: 1 }],
			])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`)
			expect(res.status).toBe(200)
		})
	})
})

describe('POST /api/events/:eventId/pool', () => {
	beforeEach(() => pool.query.mockReset())
	test('400 when card_id missing', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('400 when weight <1', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					card_id: 1,
					weight: -1,
				}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('201 adds to pool', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([{ insertId: 5 }])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card_id: 1, weight: 2 }),
			})
			expect(res.status).toBe(201)
		})
	})
	test('409 on duplicate', async () => {
		const err = new Error('dup')
		err.code = 'ER_DUP_ENTRY'
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockRejectedValueOnce(err)
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ card_id: 1 }),
			})
			expect(res.status).toBe(409)
		})
	})
})

describe('PUT /api/events/:eventId/pool/:poolId', () => {
	beforeEach(() => pool.query.mockReset())
	test('400 when no fields', async () => {
		pool.query.mockResolvedValueOnce([[{ 1: 1 }]])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool/1`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('200 updates', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([{ affectedRows: 1 }])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool/1`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ weight: 3 }),
			})
			expect(res.status).toBe(200)
		})
	})
	test('404 when not found', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([{ affectedRows: 0 }])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/events/1/pool/99`,
				{
					method: 'PUT',
					headers: {
						'Content-Type':
							'application/json',
					},
					body: JSON.stringify({ weight: 3 }),
				}
			)
			expect(res.status).toBe(404)
		})
	})
})

describe('DELETE /api/events/:eventId/pool/:poolId', () => {
	beforeEach(() => pool.query.mockReset())
	test('200 deletes', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([{ affectedRows: 1 }])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/events/1/pool/1`, {
				method: 'DELETE',
			})
			expect(res.status).toBe(200)
		})
	})
	test('404 when not found', async () => {
		pool.query
			.mockResolvedValueOnce([[{ 1: 1 }]])
			.mockResolvedValueOnce([{ affectedRows: 0 }])
		const app = makeApp({ user_id: 1 })
		await withServer(app, async (base) => {
			const res = await fetch(
				`${base}/api/events/1/pool/99`,
				{ method: 'DELETE' }
			)
			expect(res.status).toBe(404)
		})
	})
})
