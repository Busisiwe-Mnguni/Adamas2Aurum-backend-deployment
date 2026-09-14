import { distance } from './general.js'

describe('distance', () => {
	test('zero distance for same point', () => {
		expect(
			distance(
				{ latitude: 0, longitude: 0 },
				{ latitude: 0, longitude: 0 }
			)
		).toBeCloseTo(0)
	})
	test('known distance ~111km per degree latitude', () => {
		const d = distance(
			{ latitude: 0, longitude: 0 },
			{ latitude: 1, longitude: 0 }
		)
		expect(d).toBeCloseTo(111195, -2)
	})
	test('Wits to Constitution Hill ~ few km', () => {
		const d = distance(
			{ latitude: -26.1929, longitude: 28.0305 },
			{ latitude: -26.1907, longitude: 28.0412 }
		)
		expect(d).toBeGreaterThan(500)
		expect(d).toBeLessThan(2000)
	})
})
