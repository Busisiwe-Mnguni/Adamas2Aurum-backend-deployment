import { jest } from '@jest/globals'
import {
	CAMPUS_BOUNDS,
	CAMPUS_CAMERA,
	CAMPUS_MIN_ZOOM,
	CAMPUS_MAX_ZOOM,
	createCampusStyle,
	isInsideCampus,
	nightFactorAt,
	applyChromeTheme,
	applyMapTheme,
	resetCamera,
	startDayNightCycle,
	startChromeDayNightCycle,
	addGroundTexture,
} from './campus-style.js'

describe('campus-style constants', () => {
	test('bounds are sane', () => {
		expect(CAMPUS_BOUNDS.west).toBeLessThan(CAMPUS_BOUNDS.east)
		expect(CAMPUS_BOUNDS.south).toBeLessThan(CAMPUS_BOUNDS.north)
		expect(CAMPUS_MIN_ZOOM).toBeLessThan(CAMPUS_MAX_ZOOM)
		expect(CAMPUS_CAMERA.zoom).toBeGreaterThanOrEqual(
			CAMPUS_MIN_ZOOM
		)
	})
})

describe('isInsideCampus', () => {
	test('center is inside', () => {
		expect(isInsideCampus(28.0305, -26.1928)).toBe(true)
		expect(isInsideCampus(28.017, -26.198)).toBe(true) // edge inclusive
		expect(isInsideCampus(28.05, -26.173)).toBe(true)
	})
	test('outside bbox is false', () => {
		expect(isInsideCampus(28.016, -26.19)).toBe(false)
		expect(isInsideCampus(28.051, -26.19)).toBe(false)
		expect(isInsideCampus(28.03, -26.199)).toBe(false)
		expect(isInsideCampus(28.03, -26.172)).toBe(false)
	})
})

describe('createCampusStyle', () => {
	test('returns valid MapLibre style', () => {
		const style = createCampusStyle()
		expect(style.version).toBe(8)
		expect(style.sources.carto.type).toBe('vector')
		expect(style.layers.length).toBeGreaterThan(5)
		expect(
			style.layers.find((l) => l.id === 'background')
		).toBeDefined()
		expect(style.layers.find((l) => l.id === 'roads')).toBeDefined()
		expect(
			style.layers.find((l) => l.id === 'buildings-base')
		).toBeDefined()
	})
	test('each layer has id and type', () => {
		const style = createCampusStyle()
		for (const l of style.layers) {
			expect(typeof l.id).toBe('string')
			expect(typeof l.type).toBe('string')
		}
	})
})

describe('applyChromeTheme', () => {
	beforeEach(() => {
		document.body.className = ''
	})
	test('adds night class after 20:00', () => {
		const night = new Date(2026, 5, 15, 20, 0)
		expect(nightFactorAt(night)).toBeGreaterThan(0.5)
		applyChromeTheme(night)
		expect(document.body.classList.contains('night')).toBe(true)
	})
	test('removes night class at midday', () => {
		const day = new Date(2026, 5, 15, 12, 0)
		expect(nightFactorAt(day)).toBe(0)
		applyChromeTheme(day)
		expect(document.body.classList.contains('night')).toBe(false)
	})
	test('returns factor', () => {
		const d = new Date(2026, 5, 15, 12, 0)
		expect(typeof applyChromeTheme(d)).toBe('number')
	})
})

describe('applyMapTheme', () => {
	test('toggles layers and delegates to chrome', () => {
		const layers = { background: true, parks: true }
		const map = {
			getLayer: (id) => !!layers[id],
			setPaintProperty: jest.fn(),
		}
		document.body.className = ''
		const t = applyMapTheme(map, new Date(2026, 5, 15, 20, 0))
		expect(t).toBeGreaterThan(0.5)
		expect(map.setPaintProperty).toHaveBeenCalled()
		expect(document.body.classList.contains('night')).toBe(true)
	})
	test('skips missing layers gracefully', () => {
		const map = {
			getLayer: () => false,
			setPaintProperty: jest.fn(),
		}
		expect(() => applyMapTheme(map)).not.toThrow()
		expect(map.setPaintProperty).not.toHaveBeenCalled()
	})
})

describe('resetCamera', () => {
	test('calls easeTo with camera', () => {
		const map = { easeTo: jest.fn() }
		resetCamera(map, 100)
		expect(map.easeTo).toHaveBeenCalledWith(
			expect.objectContaining({
				center: CAMPUS_CAMERA.center,
				duration: 100,
			})
		)
	})
})

describe('startDayNightCycle / startChromeDayNightCycle', () => {
	test('startDayNightCycle returns stop fn and calls apply', () => {
		jest.useFakeTimers()
		const map = {
			getLayer: () => false,
			setPaintProperty: jest.fn(),
		}
		const stop = startDayNightCycle(map, 1000)
		expect(typeof stop).toBe('function')
		stop()
		jest.useRealTimers()
	})
	test('startChromeDayNightCycle returns stop', () => {
		jest.useFakeTimers()
		const stop = startChromeDayNightCycle(1000)
		expect(typeof stop).toBe('function')
		stop()
		jest.useRealTimers()
	})
})

describe('addGroundTexture', () => {
	test('no-op when map null or layer exists', () => {
		expect(addGroundTexture(null)).toBeUndefined()
		expect(
			addGroundTexture({ getLayer: () => true })
		).toBeUndefined()
	})
	test('creates texture when possible', () => {
		// jsdom canvas getContext may be null without canvas polyfill; should not throw and may early return
		const map = {
			getLayer: () => false,
			getSource: () => false,
			addImage: jest.fn(),
			addSource: jest.fn(),
			addLayer: jest.fn(),
		}
		// mock canvas
		const origCreate = document.createElement.bind(document)
		jest.spyOn(document, 'createElement').mockImplementation(
			(tag) => {
				if (tag === 'canvas') {
					const c = origCreate(tag)
					c.getContext = () => ({
						fillStyle: '',
						beginPath: jest.fn(),
						arc: jest.fn(),
						fill: jest.fn(),
						getImageData: jest.fn(
							() => ({})
						),
					})
					Object.defineProperty(c, 'width', {
						value: 128,
						writable: true,
					})
					Object.defineProperty(c, 'height', {
						value: 128,
						writable: true,
					})
					return c
				}
				return origCreate(tag)
			}
		)
		addGroundTexture(map)
		expect(map.addImage).toHaveBeenCalledWith(
			'ground-noise-tile',
			expect.anything()
		)
		expect(map.addSource).toHaveBeenCalled()
		expect(map.addLayer).toHaveBeenCalledWith(
			expect.objectContaining({ id: 'ground-noise' }),
			undefined
		)
		jest.restoreAllMocks()
	})
})
