import { svgIcon } from './icons.js'

describe('svgIcon', () => {
	test('known icon returns svg with path', () => {
		const svg = svgIcon('map-pin')
		expect(svg).toContain('<svg')
		expect(svg).toContain('M20 10c0 6')
		expect(svg).toContain('stroke="currentColor"')
	})
	test('all known icons produce svg', () => {
		for (const name of [
			'layers',
			'swords',
			'trophy',
			'pencil',
			'key',
			'settings',
			'log-out',
			'trash',
			'user',
		]) {
			const svg = svgIcon(name)
			expect(svg).toContain('<svg')
			expect(svg.length).toBeGreaterThan(20)
		}
	})
	test('unknown icon returns empty inner svg', () => {
		const svg = svgIcon('unknown-xyz')
		expect(svg).toContain('<svg')
		expect(svg).toContain('</svg>')
		// no path content beyond wrapper
		expect(svg).not.toContain('M20 10c0 6')
	})
})
