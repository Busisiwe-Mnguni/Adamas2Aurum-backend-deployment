// Pokémon GO look for Wits Quest — built from Carto vector tiles (free,
// no key, whole world): green base, parks, water, asphalt roads with
// zoom-gated lane markings. No street names, no POI symbols, no building
// shapes — known places exist purely as markers, exactly like PokéStops.
//
// Usage:
//   import { createCampusStyle, CAMPUS_CAMERA, isInsideCampus } from './campus-style.js';
//   const map = new maplibregl.Map({ container: 'map', style: createCampusStyle(), ... });
//
// campus.geojson is no longer used as a render source. It stays in public/
// for reference/future use.

// Play-area bounds (Wits Braamfontein).
export const CAMPUS_BOUNDS = {
	west: 28.017,
	south: -26.198,
	east: 28.05,
	north: -26.173,
}

// Great Hall, Wits East Campus — GPS demo fallback anchor.
export const CAMPUS_HOME = [28.0305, -26.1928]

// Default camera: tight third-person-style follow view, steeply pitched.
export const CAMPUS_CAMERA = {
	center: [28.0305, -26.1895],
	zoom: 18.5,
	pitch: 72,
	bearing: 0,
}

// PoGO-style view lock: street-level only, steep pitch enforced. Free-look
// pans freely but can never zoom out flat or flatten top-down — these same
// constants drive every game map, including reset/recenter.
export const CAMPUS_MIN_ZOOM = 17
export const CAMPUS_MAX_ZOOM = 20
export const CAMPUS_MIN_PITCH = 55
export const CAMPUS_MAX_PITCH = 75

// NOTE: intentionally NO maxBounds — players roam freely at street level;
// the campus geofence only gates *challenge attempts*, never the camera.
export const CAMPUS_MAX_BOUNDS = null

export const WORLD_MAP_STYLE =
	'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'

// Road body: bold and dominant. Ratios hold across the zoom band;
// lane markings (below) keep their own sizes.
function roadWidth() {
	return [
		'interpolate',
		['linear'],
		['zoom'],
		12,
		3,
		15,
		8,
		18,
		20,
		20,
		32,
	]
}

export function createCampusStyle() {
	return {
		version: 8,
		name: 'Wits Quest — PoGO roads',
		metadata: {
			notes: 'Pokémon GO recipe: green base, one-color roads, water, zero labels. Gameplay is markers only.',
		},
		sources: {
			carto: {
				type: 'vector',
				url: 'https://tiles.basemaps.cartocdn.com/vector/carto.streets/v1/tiles.json',
			},
		},
		layers: [
			{
				id: 'background',
				type: 'background',
				paint: { 'background-color': '#7CC5A2' },
			},
			{
				id: 'parks',
				type: 'fill',
				source: 'carto',
				'source-layer': 'park',
				paint: {
					'fill-color': '#66B78E',
					'fill-opacity': 1,
				},
			},
			{
				id: 'grass',
				type: 'fill',
				source: 'carto',
				'source-layer': 'landcover',
				filter: [
					'any',
					['==', 'class', 'wood'],
					['==', 'class', 'grass'],
				],
				paint: {
					'fill-color': '#66B78E',
					'fill-opacity': 1,
				},
			},
			{
				id: 'water',
				type: 'fill',
				source: 'carto',
				'source-layer': 'water',
				paint: {
					'fill-color': '#8ACDE8',
					'fill-opacity': 1,
				},
			},
			{
				id: 'waterway',
				type: 'line',
				source: 'carto',
				'source-layer': 'waterway',
				paint: {
					'line-color': '#8ACDE8',
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						15,
						2,
						18.5,
						6,
					],
				},
			},
			// NOTE: no building layers, by design — known places are
			// markers only (quest pins, fact-stop dots), exactly like
			// PokéStops. Their coordinates come from the events API and
			// tile POI points, never from rendered polygons.
			// Muted buildings, close to the ground hue: thin outline plus a
			// slight extrusion for shading. No per-building colors, ever.
			{
				id: 'buildings-base',
				type: 'fill-extrusion',
				source: 'carto',
				'source-layer': 'building',
				minzoom: 15,
				paint: {
					'fill-extrusion-color': '#69B795',
					'fill-extrusion-height': [
						'min',
						[
							'coalesce',
							[
								'get',
								'render_height',
							],
							8,
						],
						8,
					],
					'fill-extrusion-base': 0,
					'fill-extrusion-opacity': 1,
					'fill-extrusion-vertical-gradient': true,
				},
			},
			{
				id: 'buildings-outline',
				type: 'line',
				source: 'carto',
				'source-layer': 'building',
				minzoom: 15,
				paint: {
					'line-color': '#54A281',
					'line-width': 1,
					'line-opacity': 0.5,
				},
			},
			// Every road, one asphalt body. Rails excluded.
			{
				id: 'roads',
				type: 'line',
				source: 'carto',
				'source-layer': 'transportation',
				filter: ['!=', ['get', 'class'], 'rail'],
				paint: {
					'line-color': '#6E7683',
					'line-width': roadWidth(),
					'line-opacity': 1,
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round',
				},
			},
			// Edge markings, zoom-gated to 15+: solid pale-yellow road
			// edges with a pale outer casing — no centerlines, matching
			// the reference screenshot.
			{
				id: 'roads-edge-yellow-l',
				type: 'line',
				source: 'carto',
				'source-layer': 'transportation',
				minzoom: 15,
				filter: ['!=', ['get', 'class'], 'rail'],
				paint: {
					'line-color': '#F0CD6E',
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						0.8,
						15,
						1.2,
						20,
						2,
					],
					'line-offset': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						-0.8,
						15,
						-2.5,
						18,
						-8.5,
						20,
						-14.5,
					],
					'line-opacity': 0.95,
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round',
				},
			},
			{
				id: 'roads-edge-yellow-r',
				type: 'line',
				source: 'carto',
				'source-layer': 'transportation',
				minzoom: 15,
				filter: ['!=', ['get', 'class'], 'rail'],
				paint: {
					'line-color': '#F0CD6E',
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						0.8,
						15,
						1.2,
						20,
						2,
					],
					'line-offset': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						0.8,
						15,
						2.5,
						18,
						8.5,
						20,
						14.5,
					],
					'line-opacity': 0.95,
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round',
				},
			},
			{
				id: 'roads-edge-casing-l',
				type: 'line',
				source: 'carto',
				'source-layer': 'transportation',
				minzoom: 15,
				filter: ['!=', ['get', 'class'], 'rail'],
				paint: {
					'line-color': '#DCEBD4',
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						2,
						20,
						3,
					],
					'line-offset': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						-3.5,
						15,
						-6,
						18,
						-12,
						20,
						-18,
					],
					'line-opacity': 0.9,
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round',
				},
			},
			{
				id: 'roads-edge-casing-r',
				type: 'line',
				source: 'carto',
				'source-layer': 'transportation',
				minzoom: 15,
				filter: ['!=', ['get', 'class'], 'rail'],
				paint: {
					'line-color': '#DCEBD4',
					'line-width': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						2,
						20,
						3,
					],
					'line-offset': [
						'interpolate',
						['linear'],
						['zoom'],
						12,
						3.5,
						15,
						6,
						18,
						12,
						20,
						18,
					],
					'line-opacity': 0.9,
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round',
				},
			},
		],
	}
}

// Rectangular bbox check, not the true campus outline. Fine for a first
// pass; swap for a real point-in-polygon check (e.g. Turf.js
// booleanPointInPolygon) once you have an accurate campus boundary polygon,
// since a bbox wrongly says "on campus" just outside the real edge but still
// inside the rectangle (e.g. across the M1 highway).
export function isInsideCampus(lng, lat) {
	return (
		lng >= CAMPUS_BOUNDS.west &&
		lng <= CAMPUS_BOUNDS.east &&
		lat >= CAMPUS_BOUNDS.south &&
		lat <= CAMPUS_BOUNDS.north
	)
}

export function resetCamera(map, duration = 700) {
	map.easeTo({ ...CAMPUS_CAMERA, duration })
}

// ---------------------------------------------------------------------------
// Real-time day/night theme. Day palette is what's baked into the style
// above; night palette keeps the same hue families, just dark (PoGO-night
// vibe). Factor t in [0,1] blends between them based on real local time,
// with smooth dawn/dusk transitions so the map visibly shifts in real life.
// ---------------------------------------------------------------------------

// [day, night] paint values per layer. Only color/opacity props that differ.
const DAY_NIGHT_LAYERS = [
	{
		id: 'background',
		paint: { 'background-color': ['#7CC5A2', '#0E2233'] },
	},
	{ id: 'parks', paint: { 'fill-color': ['#66B78E', '#143A4A'] } },
	{ id: 'grass', paint: { 'fill-color': ['#66B78E', '#143A4A'] } },
	{ id: 'water', paint: { 'fill-color': ['#8ACDE8', '#0F3A5C'] } },
	{ id: 'waterway', paint: { 'line-color': ['#8ACDE8', '#0F3A5C'] } },
	{
		id: 'buildings-base',
		paint: { 'fill-extrusion-color': ['#69B795', '#1B3A4D'] },
	},
	{
		id: 'buildings-outline',
		paint: { 'line-color': ['#54A281', '#0A1E2B'] },
	},
	{ id: 'roads', paint: { 'line-color': ['#6E7683', '#2B3D55'] } },
	{
		id: 'roads-edge-yellow-l',
		paint: { 'line-color': ['#F0CD6E', '#8A743F'] },
	},
	{
		id: 'roads-edge-yellow-r',
		paint: { 'line-color': ['#F0CD6E', '#8A743F'] },
	},
	{
		id: 'roads-edge-casing-l',
		paint: { 'line-color': ['#DCEBD4', '#22344F'] },
	},
	{
		id: 'roads-edge-casing-r',
		paint: { 'line-color': ['#DCEBD4', '#22344F'] },
	},
	{ id: 'ground-noise', paint: { 'fill-opacity': [0.55, 0.25] } },
]

function lerp(a, b, t) {
	return a + (b - a) * t
}

function lerpColor(dayHex, nightHex, t) {
	const parse = (h) => [
		parseInt(h.slice(1, 3), 16),
		parseInt(h.slice(3, 5), 16),
		parseInt(h.slice(5, 7), 16),
	]
	const [r1, g1, b1] = parse(dayHex)
	const [r2, g2, b2] = parse(nightHex)
	const mix = (x, y) => Math.round(lerp(x, y, t))
	return `rgb(${mix(r1, r2)}, ${mix(g1, g2)}, ${mix(b1, b2)})`
}

// 0 = full day, 1 = full night. Night 19:30–04:30, day 07:00–17:00,
// smooth 2.5h transitions for dawn/dusk.
export function nightFactorAt(date) {
	const h = date.getHours() + date.getMinutes() / 60
	const keys = [
		[0, 1],
		[4.5, 1],
		[7, 0],
		[17, 0],
		[19.5, 1],
		[24, 1],
	]
	for (let i = 0; i + 1 < keys.length; i++) {
		const [h0, v0] = keys[i]
		const [h1, v1] = keys[i + 1]
		if (h >= h0 && h <= h1) {
			const t = (h - h0) / (h1 - h0 || 1)
			const s = t * t * (3 - 2 * t) // smoothstep
			return lerp(v0, v1, s)
		}
	}
	return 0
}

// Apply the blended theme to a live map + page chrome. Returns the factor.
// Missing layers (e.g. ground-noise before it's added) are skipped, so this
// is safe to call on every tick. Fog/cloud night variants live in CSS under
// `body.night`; this just flips the class.
export function applyMapTheme(map, date = new Date()) {
	const t = nightFactorAt(date)
	for (const { id, paint } of DAY_NIGHT_LAYERS) {
		if (!map.getLayer(id)) continue
		for (const [prop, [day, night]] of Object.entries(paint)) {
			map.setPaintProperty(
				id,
				prop,
				typeof day === 'string'
					? lerpColor(day, night, t)
					: lerp(day, night, t)
			)
		}
	}
	if (typeof document !== 'undefined') {
		document.body.classList.toggle('night', t > 0.5)
	}
	return t
}

// Re-applies the theme every minute so dawn/dusk visibly shift in real life.
export function startDayNightCycle(map, intervalMs = 60000) {
	applyMapTheme(map)
	const id = setInterval(() => applyMapTheme(map), intervalMs)
	return () => clearInterval(id)
}

// Matte ground texture: a tiny seamless noise tile generated at runtime
// (wrapped dots so edges tile invisibly), painted at low contrast over the
// whole world via a fullscreen GeoJSON polygon. Purely a finish change —
// same base hue, no gloss anywhere (all fills are flat).
// Call once per map after its style loads; safe to call twice (guarded).
export function addGroundTexture(map, beforeLayerId) {
	if (!map || map.getLayer('ground-noise')) return
	const size = 128
	const canvas = document.createElement('canvas')
	canvas.width = size
	canvas.height = size
	const ctx = canvas.getContext('2d')
	for (let i = 0; i < 700; i++) {
		const x = Math.random() * size
		const y = Math.random() * size
		const r = Math.random() * 2 + 0.5
		ctx.fillStyle =
			Math.random() < 0.5
				? 'rgba(60, 110, 70, 0.10)'
				: 'rgba(255, 255, 255, 0.07)'
		// Draw wrapped copies so the tile repeats seamlessly.
		for (const ox of [-size, 0, size]) {
			for (const oy of [-size, 0, size]) {
				ctx.beginPath()
				ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2)
				ctx.fill()
			}
		}
	}
	try {
		map.addImage(
			'ground-noise-tile',
			ctx.getImageData(0, 0, size, size)
		)
	} catch {
		return // WebGL/image unavailable — map still works, just flat.
	}
	if (!map.getSource('ground-noise-src')) {
		map.addSource('ground-noise-src', {
			type: 'geojson',
			data: {
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'Polygon',
					coordinates: [
						[
							[-180, -85],
							[180, -85],
							[180, 85],
							[-180, 85],
							[-180, -85],
						],
					],
				},
			},
		})
	}
	map.addLayer(
		{
			id: 'ground-noise',
			type: 'fill',
			source: 'ground-noise-src',
			paint: {
				'fill-pattern': 'ground-noise-tile',
				'fill-opacity': 0.55,
			},
		},
		beforeLayerId
	)
}
