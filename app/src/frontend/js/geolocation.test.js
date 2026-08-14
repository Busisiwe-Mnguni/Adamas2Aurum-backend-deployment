import { jest } from '@jest/globals';

import { get_player_location } from './geolocation.js'

describe('get_player_location', () => {
	const original_geolocation = global.navigator?.geolocation

	afterEach(() => {
		jest.restoreAllMocks()
		Object.defineProperty(global.navigator, 'geolocation', {
			value: original_geolocation,
			configurable: true,
		})
	})

	test('resolves with [latitude, longitude] on success', async () => {
		const mock_get_current_position = jest.fn((success) => {
			success({
				coords: {
					latitude: 12.3456,
					longitude: -65.4321,
				},
			})
		})

		Object.defineProperty(global.navigator, 'geolocation', {
			value: { getCurrentPosition: mock_get_current_position },
			configurable: true,
		})

		const result = await get_player_location()
		expect(result).toEqual([12.3456, -65.4321])
		expect(mock_get_current_position).toHaveBeenCalledTimes(1)
	})
})
