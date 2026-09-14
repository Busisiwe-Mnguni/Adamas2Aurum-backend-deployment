import { jest } from '@jest/globals'
import { isAdmin, redirectAfterLogin, logout } from './auth-helpers.js'

describe('auth-helpers', () => {
	describe('isAdmin', () => {
		test('returns true for admin roles', () => {
			expect(isAdmin({ roles: ['SUPER_ADMIN'] })).toBe(true)
			expect(isAdmin({ roles: ['EVENT_AUTHOR'] })).toBe(true)
			expect(isAdmin({ roles: ['CARD_AUTHOR'] })).toBe(true)
		})

		test('returns false for regular players or empty roles', () => {
			expect(isAdmin({ roles: [] })).toBe(false)
			expect(isAdmin({ roles: ['PLAYER'] })).toBe(false)
			expect(isAdmin(null)).toBe(false)
			expect(isAdmin(undefined)).toBe(false)
		})
	})

	describe('redirectAfterLogin', () => {
		const originalLocation = window.location

		beforeEach(() => {
			delete window.location
			window.location = { href: '' }
		})

		afterEach(() => {
			window.location = originalLocation
		})

		test('redirects admins to console', () => {
			redirectAfterLogin({ roles: ['SUPER_ADMIN'] })
			expect(window.location.href).toBe('/pages/console.html')
		})

		test('redirects players to events dashboard', () => {
			redirectAfterLogin({ roles: [] })
			expect(window.location.href).toBe('/pages/events.html')
		})
	})

	describe('logout', () => {
		const originalLocation = window.location
		const originalFetch = global.fetch

		beforeEach(() => {
			delete window.location
			window.location = { href: '' }
		})

		afterEach(() => {
			window.location = originalLocation
			global.fetch = originalFetch
		})

		test('clears both express session and better-auth session, then redirects to /', async () => {
			const fetchMock = jest
				.fn()
				.mockResolvedValue({ ok: true })
			global.fetch = fetchMock

			await logout()

			expect(fetchMock).toHaveBeenCalledTimes(2)
			const calledUrls = fetchMock.mock.calls.map(
				(call) => call[0]
			)
			expect(calledUrls).toContain(
				'http://localhost:3000/api/auth/logout'
			)
			expect(calledUrls).toContain(
				'http://localhost:3000/api/auth/sign-out'
			)
			expect(window.location.href).toBe('/')
		})

		test('redirects to / even if fetch calls fail', async () => {
			const fetchMock = jest
				.fn()
				.mockRejectedValue(new Error('Network error'))
			global.fetch = fetchMock

			await logout()

			expect(window.location.href).toBe('/')
		})
	})
})
