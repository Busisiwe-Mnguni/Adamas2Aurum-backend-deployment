import { jest } from '@jest/globals'
import crypto from 'crypto'
jest.unstable_mockModule('../utils/db.js', () => ({
	default: { query: jest.fn() },
}))
const { default: pool } = await import('../utils/db.js')
const { default: authRouter } = await import('./auth.js')
import express from 'express'
import { createServer } from 'http'

function hash(pin) {
	return crypto
		.createHash('sha256')
		.update(String(pin))
		.digest('hex')
		.toLowerCase()
}

function makeApp(session = {}) {
	const app = express()
	app.use(express.json())
	app.use((req, _res, next) => {
		req.session = session
		next()
	})
	app.use('/api/auth', authRouter)
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

describe('POST /api/auth/login', () => {
	beforeEach(() => pool.query.mockReset())
	test('400 when missing fields', async () => {
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('401 when user not found', async () => {
		pool.query.mockResolvedValueOnce([[]])
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'a@a.com',
					pin: '1234',
				}),
			})
			expect(res.status).toBe(401)
		})
	})
	test('401 when pin wrong', async () => {
		pool.query
			.mockResolvedValueOnce([
				[{ user_id: 1, name: 'A', email: 'a@a.com' }],
			])
			.mockResolvedValueOnce([[{ pin_hash: hash('9999') }]])
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'a@a.com',
					pin: '1234',
				}),
			})
			expect(res.status).toBe(401)
		})
	})
	test('200 login success', async () => {
		pool.query
			.mockResolvedValueOnce([
				[{ user_id: 1, name: 'A', email: 'a@a.com' }],
			])
			.mockResolvedValueOnce([[{ pin_hash: hash('1234') }]])
			.mockResolvedValueOnce([[{ role: 'SUPER_ADMIN' }]])
		const session = {}
		const app = makeApp(session)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'a@a.com',
					pin: '1234',
				}),
			})
			expect(res.status).toBe(200)
			const body = await res.json()
			expect(body.user.roles).toContain('SUPER_ADMIN')
		})
		expect(session.user).toBeDefined()
	})
	test('accepts password field as pin alias', async () => {
		pool.query
			.mockResolvedValueOnce([
				[{ user_id: 1, name: 'A', email: 'a@a.com' }],
			])
			.mockResolvedValueOnce([[{ pin_hash: hash('1234') }]])
			.mockResolvedValueOnce([[]])
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: 'a@a.com',
					password: '1234',
				}),
			})
			expect(res.status).toBe(200)
		})
	})
})

describe('POST /api/auth/register', () => {
	beforeEach(() => pool.query.mockReset())
	test('400 when missing', async () => {
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'A' }),
			})
			expect(res.status).toBe(400)
		})
	})
	test('400 when email exists', async () => {
		pool.query.mockResolvedValueOnce([[{ user_id: 1 }]])
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'A',
					email: 'a@a.com',
					pin: '1234',
				}),
			})
			expect(res.status).toBe(400)
		})
	})
	test('201 creates user', async () => {
		pool.query
			.mockResolvedValueOnce([[]]) // existing
			.mockResolvedValueOnce([{ insertId: 2 }]) // insert users
			.mockResolvedValueOnce([{ affectedRows: 1 }]) // insert creds
			.mockResolvedValueOnce([[]]) // roles
		const session = {}
		const app = makeApp(session)
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/register`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: 'Bob',
					email: 'bob@a.com',
					pin: '1234',
				}),
			})
			expect(res.status).toBe(201)
			expect(session.user.email).toBe('bob@a.com')
		})
	})
})

describe('GET /api/auth/me', () => {
	beforeEach(() => pool.query.mockReset())
	test('401 when no session', async () => {
		const app = makeApp({})
		await withServer(app, async (base) => {
			const res = await fetch(`${base}/api/auth/me`)
			expect(res.status).toBe(401)
		})
	})
	test('200 returns user with roles', async () => {
		pool.query.mockResolvedValueOnce([[{ role: 'EVENT_AUTHOR' }]])
		const app = makeApp({
			user: { user_id: 1, name: 'A', email: 'a@a.com' },
		})
		// need session.user for me route: it reads req.session.user
		const sess = {
			user: { user_id: 1, name: 'A', email: 'a@a.com' },
		}
		const app2 = express()
		app2.use(express.json())
		app2.use((req, _res, next) => {
			req.session = sess
			next()
		})
		app2.use('/api/auth', authRouter)
		const server = createServer(app2)
		await new Promise((r) => server.listen(0, '127.0.0.1', r))
		const { port } = server.address()
		const res = await fetch(`http://127.0.0.1:${port}/api/auth/me`)
		expect(res.status).toBe(200)
		const body = await res.json()
		expect(body.roles).toContain('EVENT_AUTHOR')
		await new Promise((r) => server.close(r))
	})
})

describe('POST /api/auth/logout', () => {
	test('200 logout', async () => {
		const sess = { destroy: (cb) => cb() }
		const app = express()
		app.use(express.json())
		app.use((req, _res, next) => {
			req.session = sess
			next()
		})
		app.use('/api/auth', authRouter)
		const server = createServer(app)
		await new Promise((r) => server.listen(0, '127.0.0.1', r))
		const { port } = server.address()
		const res = await fetch(
			`http://127.0.0.1:${port}/api/auth/logout`,
			{ method: 'POST' }
		)
		expect(res.status).toBe(200)
		await new Promise((r) => server.close(r))
	})
})
