import { jest } from '@jest/globals';

import { get_player_location } from './geolocation.js'

describe('get_player_location', () => {
	const originalGeolocation = global.navigator?.geolocation

	afterEach(() => {
		jest.restoreAllMocks()
		Object.defineProperty(global.navigator, 'geolocation', {
			value: originalGeolocation,
			configurable: true,
		})
	})

	test('resolves with [latitude, longitude] on success', async () => {
		const mockGetCurrentPosition = jest.fn((success) => {
			success({
				coords: {
					latitude: 12.3456,
					longitude: -65.4321,
				},
			})
		})

		Object.defineProperty(global.navigator, 'geolocation', {
			value: { getCurrentPosition: mockGetCurrentPosition },
			configurable: true,
		})

		const result = await get_player_location()
		expect(result).toEqual([12.3456, -65.4321])
		expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1)
	})
})
