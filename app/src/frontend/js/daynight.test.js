import { nightFactorAt } from './campus-style.js'

const at = (h, m = 0) => {
	const d = new Date(2026, 5, 15, h, m)
	return nightFactorAt(d)
}

describe('nightFactorAt', () => {
	test('deep night is fully night', () => {
		expect(at(0)).toBe(1)
		expect(at(2, 30)).toBe(1)
		expect(at(23, 59)).toBe(1)
	})

	test('midday is fully day', () => {
		expect(at(12)).toBe(0)
		expect(at(9)).toBe(0)
		expect(at(16, 59)).toBe(0)
	})

	test('dawn transitions smoothly from night to day', () => {
		const early = at(5)
		const mid = at(5, 45)
		const late = at(6, 30)
		expect(early).toBeGreaterThan(mid)
		expect(mid).toBeGreaterThan(late)
		expect(early).toBeLessThanOrEqual(1)
		expect(late).toBeGreaterThanOrEqual(0)
	})

	test('dusk transitions smoothly from day to night', () => {
		const early = at(17, 30)
		const mid = at(18, 15)
		const late = at(19)
		expect(early).toBeLessThan(mid)
		expect(mid).toBeLessThan(late)
	})

	test('factor always stays in [0, 1]', () => {
		for (let h = 0; h < 24; h++) {
			const v = at(h, 30)
			expect(v).toBeGreaterThanOrEqual(0)
			expect(v).toBeLessThanOrEqual(1)
		}
	})
})
