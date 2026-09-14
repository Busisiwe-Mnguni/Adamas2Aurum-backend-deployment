import { jest } from '@jest/globals'
import {
	esc,
	formatDT,
	toDatetimeLocal,
	toUtcIso,
	buildCardBody,
	curationBadge,
	showToast,
} from './utils.js'

describe('esc', () => {
	test('escapes HTML special chars', () => {
		expect(esc('<script>alert("x")</script>')).toBe(
			'&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;'
		)
		expect(esc('a & b')).toBe('a &amp; b')
		expect(esc(null)).toBe('')
		expect(esc(undefined)).toBe('')
	})
})

describe('formatDT', () => {
	test('returns null for falsy', () => {
		expect(formatDT(null)).toBeNull()
		expect(formatDT('')).toBeNull()
		expect(formatDT(undefined)).toBeNull()
	})
	test('formats valid ISO', () => {
		const out = formatDT('2026-03-15T10:30:00.000Z')
		expect(typeof out).toBe('string')
		expect(out).toMatch(/2026/)
	})
	test('returns Invalid Date string for unparseable input (toLocaleString does not throw)', () => {
		const out = formatDT('not-a-date')
		expect(out).toMatch(/Invalid Date|not-a-date/)
	})
})

describe('toDatetimeLocal', () => {
	test('empty returns ""', () => {
		expect(toDatetimeLocal(null)).toBe('')
		expect(toDatetimeLocal('')).toBe('')
	})
	test('invalid returns ""', () => {
		expect(toDatetimeLocal('not-a-date')).toBe('')
	})
	test('valid ISO returns YYYY-MM-DDTHH:MM', () => {
		const v = toDatetimeLocal('2026-03-15T10:30:00.000Z')
		expect(v).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
	})
})

describe('toUtcIso', () => {
	test('null/empty returns null', () => {
		expect(toUtcIso(null)).toBeNull()
		expect(toUtcIso('')).toBeNull()
	})
	test('invalid returns null', () => {
		expect(toUtcIso('bad')).toBeNull()
	})
	test('valid local value returns ISO string', () => {
		const iso = toUtcIso('2026-03-15T10:30')
		expect(iso).toMatch(/2026-03-15T/)
		expect(iso.endsWith('Z')).toBe(true)
	})
})

describe('buildCardBody', () => {
	test('renders title, description, pills', () => {
		const html = buildCardBody({
			title: 'Tower',
			description: 'Hello',
			is_active: true,
			curation_status: 'PUBLISHED',
			radius_meters: 50,
			point_reward: 10,
			starts_at: null,
			ends_at: null,
			point_threshold: 0,
			campaign_id: null,
		})
		expect(html).toContain('Tower')
		expect(html).toContain('Hello')
		expect(html).toContain('PUBLISHED')
		expect(html).toContain('Active')
		expect(html).toContain('📍 50m')
	})
	test('escapes title', () => {
		const html = buildCardBody({
			title: '<b>Hi</b>',
			description: null,
			is_active: false,
			curation_status: 'DRAFT',
			radius_meters: 10,
			point_reward: 5,
			starts_at: '2026-01-01T00:00:00.000Z',
			ends_at: '2026-12-31T00:00:00.000Z',
			point_threshold: 5,
			campaign_id: 2,
		})
		expect(html).toContain('&lt;b&gt;Hi&lt;/b&gt;')
		expect(html).not.toContain('<b>Hi</b>')
		expect(html).toContain('DRAFT')
		expect(html).toContain('Inactive')
		expect(html).toContain('Campaign #2')
		expect(html).toContain('🔒 5 pts')
	})
	test('defaults curation when missing: active->PUBLISHED, inactive->DRAFT', () => {
		const a = buildCardBody({
			title: 'A',
			is_active: true,
			radius_meters: 10,
			point_reward: 1,
			point_threshold: 0,
		})
		expect(a).toContain('PUBLISHED')
		const b = buildCardBody({
			title: 'B',
			is_active: false,
			radius_meters: 10,
			point_reward: 1,
			point_threshold: 0,
		})
		expect(b).toContain('DRAFT')
	})
	test('handles IN_REVIEW gold class and RETIRED inactive', () => {
		const ir = buildCardBody({
			title: 'X',
			is_active: true,
			curation_status: 'IN_REVIEW',
			radius_meters: 10,
			point_reward: 1,
			point_threshold: 0,
		})
		expect(ir).toContain('IN REVIEW')
		expect(ir).toContain('gold')
		const ret = buildCardBody({
			title: 'Y',
			is_active: true,
			curation_status: 'RETIRED',
			radius_meters: 10,
			point_reward: 1,
			point_threshold: 0,
		})
		expect(ret).toContain('RETIRED')
		expect(ret).toContain('inactive')
	})
})

describe('curationBadge', () => {
	test('maps statuses to classes', () => {
		expect(curationBadge('PUBLISHED')).toContain('active')
		expect(curationBadge('PUBLISHED')).toContain('PUBLISHED')
		expect(curationBadge('IN_REVIEW')).toContain('gold')
		expect(curationBadge('DRAFT')).toContain('DRAFT')
		expect(curationBadge('RETIRED')).toContain('inactive')
		expect(curationBadge(null)).toContain('DRAFT')
		expect(curationBadge('ARCHIVED')).toContain('inactive')
	})
	test('escapes status', () => {
		expect(curationBadge('<script>')).not.toContain('<script>')
	})
})

describe('showToast', () => {
	test('sets toast text and class, clears after timeout', () => {
		jest.useFakeTimers()
		document.body.innerHTML = '<div id="toast" class="toast"></div>'
		showToast('hello', 'success')
		const el = document.getElementById('toast')
		expect(el.textContent).toBe('hello')
		expect(el.className).toContain('show')
		expect(el.className).toContain('success')
		jest.advanceTimersByTime(3300)
		expect(el.className).toBe('toast')
		jest.useRealTimers()
	})
	test('no-ops when #toast missing', () => {
		document.body.innerHTML = ''
		expect(() => showToast('hi')).not.toThrow()
	})
})
