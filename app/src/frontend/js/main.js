import {
	emailSignIn,
	emailSignUp,
	googleSignIn,
	baSignOut,
	clearBridgeSession,
} from './auth-client.js'
import { get_player_location } from './geolocation.js'
import {
	createCampusStyle,
	CAMPUS_CAMERA,
	CAMPUS_HOME,
	CAMPUS_MIN_ZOOM,
	CAMPUS_MAX_ZOOM,
	CAMPUS_MIN_PITCH,
	CAMPUS_MAX_PITCH,
	isInsideCampus,
	addGroundTexture,
	startDayNightCycle,
} from './campus-style.js'

const API_BASE = '/api'
let currentUser = null
let map = null
let playerMarker = null
let playerDotEl = null
let playerAccuracyEl = null

let playerCoords = [...CAMPUS_HOME]
let playerAccuracyMeters = 0
let followMode = true
let demoMode = true // true until a real GPS fix arrives
let watchId = null
let lastInside = null // last geofence state: true/false/null (unknown)

// Avatar motion state: heading in degrees (0 = north), walk/idle visual,
// and a short trail of fading breadcrumb dots.
let playerHeading = 0
let lastMoveAt = 0
let walkTimer = null
let lastCrumbAt = null
const crumbs = []
const MAX_CRUMBS = 20

// Tracked stop markers for proximity glow + radius circles.
const stopMarkers = []
let pullbackTimer = null
const STEP_SIZE = 0.00008 // WASD step distance

// Dev-test simulated fixes (same coordinates as the v4 preview).
const SIM_ON_CAMPUS = [28.0345, -26.1875]
const SIM_OFF_CAMPUS = [28.0567, -26.1076] // e.g. Sandton — well outside

/**
 * ACCURATE WITS BRAAMFONTEIN CAMPUS BUILDINGS
 */
async function fetchCampusEvents() {
	try {
		const res = await fetch(`${API_BASE}/events`)
		if (res.ok) {
			const dbEvents = await res.json()
			if (Array.isArray(dbEvents) && dbEvents.length > 0) {
				return dbEvents.map((event) => ({
					id: event.event_id,
					name: event.title,
					campus: event.campus || 'Wits Campus',
					category: event.category || 'General',
					description: event.description || '',
					coordinates: [
						parseFloat(event.longitude),
						parseFloat(event.latitude),
					],
					radius_meters: event.radius_meters,
					hasChallenge:
						event.point_reward > 0 ||
						event.hasChallenge,
				}))
			}
		}
	} catch (err) {
		console.warn(
			'Backend API offline, loading verified Wits Campus markers:',
			err
		)
	}

	// Verified Wits Braamfontein East & West Campus Pin Coordinates
	return [
		{
			id: 1,
			name: 'Great Hall',
			campus: 'East Campus',
			category: 'Landmark',
			description: '🏛️ Main iconic graduation hall & steps.',
			coordinates: [28.0305, -26.1928],
			hasChallenge: true,
		},
		{
			id: 2,
			name: 'Solomon Mahlangu House',
			campus: 'East Campus',
			category: 'Administration',
			description: '🏢 Main admin & senate building.',
			coordinates: [28.0312, -26.1932],
			hasChallenge: true,
		},
		{
			id: 3,
			name: 'William Cullen Library',
			campus: 'East Campus',
			category: 'Library',
			description: '📚 Central historic library.',
			coordinates: [28.0301, -26.1916],
			hasChallenge: true,
		},
		{
			id: 4,
			name: 'Wits Art Museum (WAM)',
			campus: 'East Campus',
			category: 'Museum',
			description: '🎨 Art gallery on Jan Smuts Ave.',
			coordinates: [28.0332, -26.1935],
			hasChallenge: false,
		},
		{
			id: 5,
			name: 'Umthombo Building',
			campus: 'East Campus',
			category: 'Academic',
			description: '📖 Major lecture hall complex.',
			coordinates: [28.0315, -26.1908],
			hasChallenge: true,
		},
		{
			id: 6,
			name: 'The Matrix',
			campus: 'West Campus',
			category: 'Student Hub',
			description: '🍔 Main student center & food court.',
			coordinates: [28.0256, -26.1902],
			hasChallenge: true,
		},
		{
			id: 7,
			name: 'FNB Building',
			campus: 'West Campus',
			category: 'Academic',
			description: '📊 School of Accountancy & Commerce.',
			coordinates: [28.025, -26.1888],
			hasChallenge: false,
		},
		{
			id: 8,
			name: 'Commerce Library',
			campus: 'West Campus',
			category: 'Library',
			description: '📖 Law & commerce research library.',
			coordinates: [28.0248, -26.1908],
			hasChallenge: true,
		},
		{
			id: 9,
			name: 'Science Stadium',
			campus: 'West Campus',
			category: 'Academic',
			description: '🔬 Large science lecture auditoriums.',
			coordinates: [28.0242, -26.1925],
			hasChallenge: true,
		},
		{
			id: 10,
			name: 'Chamber of Mines',
			campus: 'West Campus',
			category: 'Engineering',
			description: '⛏️ Faculty of Engineering building.',
			coordinates: [28.0262, -26.192],
			hasChallenge: false,
		},
	]
}

function buildPopupContent(buildingData) {
	const challengeButtonHtml = buildingData.hasChallenge
		? `<button style="background:#2ecc71; color:white; border:none; padding:8px 12px; border-radius:6px; margin-top:8px; width:100%; font-weight:bold; cursor:pointer;" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
		: `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`

	return `
    <div style="padding: 4px; min-width: 180px;">
      <h3 style="margin: 0 0 4px 0; color: #0c2461; font-size: 1rem;">${buildingData.name}</h3>
      <p style="margin: 4px 0; font-size: 0.85rem; color: #333;">${buildingData.description}</p>
      <span style="font-size: 0.75rem; background: #f1f2f6; color: #2c3e50; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div>${challengeButtonHtml}</div>
    </div>
  `
}

function createBuildingPinElement(building) {
	const el = document.createElement('div')
	el.className = `pokestop ${building.hasChallenge ? 'gym' : ''}`
	el.title = building.name
	// PokéStop structure: floating cube on a slim pole over a ground ring.
	// .pokestop-bob carries the JS proximity scale; inner parts animate
	// independently via CSS.
	el.innerHTML = `<div class="pokestop-bob"><div class="stop-cube"><span>${building.hasChallenge ? '⚡' : '◈'}</span></div><div class="stop-pole"></div><div class="stop-ring"></div></div>`
	return el
}

// Approx meters between two [lng, lat] pairs (equirectangular — plenty for
// sub-kilometer game distances).
function distanceMeters(a, b) {
	const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
	const dx = (a[0] - b[0]) * kx
	const dy = (a[1] - b[1]) * 110540
	return Math.hypot(dx, dy)
}

function bearingBetween(a, b) {
	const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
	const dx = (b[0] - a[0]) * kx
	const dy = (b[1] - a[1]) * 110540
	return (Math.atan2(dx, dy) * 180) / Math.PI
}

function setHeading(deg) {
	playerHeading = ((deg % 360) + 360) % 360
	const wedge = playerDotEl?.querySelector('.pogo-wedge')
	if (wedge) wedge.style.transform = `rotate(${playerHeading}deg)`
}

function setWalking(on) {
	const dot = playerDotEl?.querySelector('.pogo-dot')
	if (!dot) return
	dot.classList.toggle('walking', on)
	dot.classList.toggle('idle', !on)
	if (on) {
		lastMoveAt = Date.now()
		clearTimeout(walkTimer)
		walkTimer = setTimeout(() => setWalking(false), 2500)
	}
}

function dropCrumb(lng, lat) {
	if (lastCrumbAt && distanceMeters(lastCrumbAt, [lng, lat]) < 10) return
	lastCrumbAt = [lng, lat]
	const el = document.createElement('div')
	el.className = 'crumb'
	const marker = new maplibregl.Marker({ element: el })
		.setLngLat([lng, lat])
		.addTo(map)
	crumbs.push(marker)
	while (crumbs.length > MAX_CRUMBS) crumbs.shift().remove()
	setTimeout(() => {
		const i = crumbs.indexOf(marker)
		if (i >= 0) crumbs.splice(i, 1)
		marker.remove()
	}, 25000)
}

// Scale/glow each stop by live proximity (full glow inside ~40m, fading to
// baseline past ~250m). Applied to the INNER bob element — MapLibre owns
// the outer marker element's transform for positioning, so touching it
// would teleport the pin.
function refreshStopGlow() {
	for (const { el, lng, lat } of stopMarkers) {
		const d = distanceMeters(playerCoords, [lng, lat])
		const t = Math.max(0, Math.min(1, 1 - (d - 40) / 210))
		el.style.transform = `scale(${(1 + 0.4 * t).toFixed(3)})`
		el.style.setProperty('--pg', t.toFixed(3))
	}
}

// Translucent trigger-radius discs under each stop (event.radius_meters,
// 60m fallback) — transparency + gameplay in one visual.
function renderProximityCircles(stops) {
	if (!map || map.getSource('event-radii')) return
	const features = stops
		.filter((s) => Array.isArray(s.coordinates))
		.map((s) => ({
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'Polygon',
				coordinates: [
					circleCoords(
						s.coordinates[0],
						s.coordinates[1],
						s.radius_meters || 60
					),
				],
			},
		}))
	if (!features.length) return
	map.addSource('event-radii', {
		type: 'geojson',
		data: { type: 'FeatureCollection', features },
	})
	map.addLayer({
		id: 'event-radii-fill',
		type: 'fill',
		source: 'event-radii',
		paint: {
			'fill-color': '#2F9DF0',
			'fill-opacity': 0.1,
		},
	})
	map.addLayer({
		id: 'event-radii-line',
		type: 'line',
		source: 'event-radii',
		paint: {
			'line-color': '#2F9DF0',
			'line-width': 1.5,
			'line-opacity': 0.35,
			'line-dasharray': [4, 3],
		},
	})
}

function circleCoords(lng, lat, radiusMeters, steps = 48) {
	const pts = []
	const kx = 111320 * Math.cos((lat * Math.PI) / 180)
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * Math.PI * 2
		pts.push([
			lng + (Math.cos(a) * radiusMeters) / kx,
			lat + (Math.sin(a) * radiusMeters) / 110540,
		])
	}
	return pts
}

// ---- Off-campus ambient fact stops ("wild flavor", not quests) ----
// Sourced live from the already-loaded vector tiles (poi layer), so this
// works anywhere in the world with zero extra data pipeline. Only named
// POIs qualify — plain buildings get nothing, keeping density PoGO-sparse.
// Visuals stay deliberately lower-stakes: tiny static "i" dots, no pulse,
// no radius. Tapping shows tile facts only — no minigame, no card.
// (Tile fields are a subset of OSM tags, so deeper qualification like
// wikipedia/wikidata lookups is deferred; see report.)
const factMarkers = []
const MAX_FACT_STOPS = 12
const FACT_MIN_ZOOM = 15.5

function clearFactStops() {
	for (const m of factMarkers) m.remove()
	factMarkers.length = 0
}

function escapeHtml(v) {
	return String(v).replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;',
			})[c]
	)
}

function humanizeKind(v) {
	return String(v || '')
		.replace(/_/g, ' ')
		.trim()
}

function refreshFactStops() {
	if (!map) return
	// Quest markers rule on campus — ambient flavor is off-campus only.
	if (
		isInsideCampus(playerCoords[0], playerCoords[1]) ||
		map.getZoom() < FACT_MIN_ZOOM
	) {
		clearFactStops()
		return
	}
	let feats = []
	try {
		feats = map.querySourceFeatures('carto', {
			sourceLayer: 'poi',
			filter: ['has', 'name'],
		})
	} catch {
		return
	}
	const bounds = map.getBounds()
	const center = map.getCenter().toArray()
	const seen = new Set()
	const scored = []
	for (const f of feats) {
		const name = f.properties?.name
		const g = f.geometry
		if (!name || !g || g.type !== 'Point') continue
		const [lng, lat] = g.coordinates
		if (
			lng < bounds.getWest() ||
			lng > bounds.getEast() ||
			lat < bounds.getSouth() ||
			lat > bounds.getNorth()
		)
			continue
		const key = `${name}|${lng.toFixed(4)},${lat.toFixed(4)}`
		if (seen.has(key)) continue
		seen.add(key)
		scored.push({
			lng,
			lat,
			name,
			kind: f.properties.class,
			d: distanceMeters([lng, lat], center),
		})
	}
	scored.sort((a, b) => a.d - b.d)
	clearFactStops()
	for (const s of scored.slice(0, MAX_FACT_STOPS)) {
		const el = document.createElement('div')
		el.className = 'fact-dot'
		el.title = s.name
		el.textContent = 'i'
		const popup = new maplibregl.Popup({
			offset: 12,
		}).setHTML(
			`<div class="fact-card"><h3>${escapeHtml(s.name)}</h3>` +
				(s.kind
					? `<p class="fact-kind">${escapeHtml(humanizeKind(s.kind))}</p>`
					: '') +
				`<p class="fact-note">🚏 Off-campus flavor stop — explore, no challenge here.</p></div>`
		)
		factMarkers.push(
			new maplibregl.Marker({ element: el })
				.setLngLat([s.lng, s.lat])
				.setPopup(popup)
				.addTo(map)
		)
	}
}

// Compass fallback for facing: GPS bearing wins while moving; otherwise
// ease toward the device compass where the browser exposes one. (iOS
// requires a user-gesture permission prompt for motion data, so this stays
// best-effort — no permission flow is triggered here.)
function setupOrientation() {
	const handler = (e) => {
		if (Date.now() - lastMoveAt < 4000) return
		let heading = null
		if (typeof e.webkitCompassHeading === 'number') {
			heading = e.webkitCompassHeading
		} else if (
			typeof e.alpha === 'number' &&
			e.absolute !== false
		) {
			heading = 360 - e.alpha
		}
		if (heading !== null && Number.isFinite(heading)) {
			setHeading(heading)
		}
	}
	window.addEventListener('deviceorientationabsolute', handler, true)
	window.addEventListener('deviceorientation', handler, true)
}

// Soft camera pull-back toward campus after 25s idle far away. Only arms
// when free-looking (never while following GPS) and fires only if the
// camera is still outside the campus bbox when the timer lapses.
const PULLBACK_IDLE_MS = 25000

function clearPullback() {
	if (pullbackTimer) {
		clearTimeout(pullbackTimer)
		pullbackTimer = null
	}
}

function armPullback() {
	clearPullback()
	if (!map || followMode || document.hidden) return
	const c = map.getCenter()
	if (isInsideCampus(c.lng, c.lat)) return
	pullbackTimer = setTimeout(() => {
		pullbackTimer = null
		if (!map || followMode || document.hidden) return
		const now = map.getCenter()
		if (!isInsideCampus(now.lng, now.lat)) {
			map.easeTo({ ...CAMPUS_CAMERA, duration: 1200 })
		}
	}, PULLBACK_IDLE_MS)
}

/**
 * PLAYER DOT — Pokémon-GO blue dot + accuracy circle, with follow mode.
 */
function setStatusChip(mode, text) {
	const chip = document.getElementById('gps-status')
	if (!chip) return
	chip.dataset.mode = mode
	chip.querySelector('.gps-text').textContent = text
}

function metersPerPixel(lat, zoom) {
	return (
		(156543.03392 * Math.cos((lat * Math.PI) / 180)) /
		Math.pow(2, zoom)
	)
}

function updateAccuracyCircle() {
	if (!playerAccuracyEl || !map) return
	const px = playerAccuracyMeters
		? Math.min(
				220,
				Math.max(
					18,
					(playerAccuracyMeters /
						metersPerPixel(
							playerCoords[1],
							map.getZoom()
						)) *
						2
				)
			)
		: 44
	playerAccuracyEl.style.width = `${px}px`
	playerAccuracyEl.style.height = `${px}px`
}

function ensurePlayerMarker() {
	if (playerMarker) return
	const el = document.createElement('div')
	el.className = 'pogo-player'
	el.innerHTML = `<div class="pogo-accuracy"></div><div class="pogo-wedge"></div><div class="pogo-dot idle"></div>`
	playerDotEl = el
	playerAccuracyEl = el.querySelector('.pogo-accuracy')
	playerMarker = new maplibregl.Marker({ element: el })
		.setLngLat(playerCoords)
		.addTo(map)
	updateAccuracyCircle()
	setHeading(playerHeading)
}

function movePlayerTo([lng, lat], { center = false, accuracy = 0 } = {}) {
	const prev = [...playerCoords]
	playerCoords = [lng, lat]
	if (accuracy > 0) playerAccuracyMeters = accuracy
	ensurePlayerMarker()
	playerMarker.setLngLat(playerCoords)
	updateAccuracyCircle()
	const moved = distanceMeters(prev, playerCoords)
	if (moved > 2) {
		setHeading(bearingBetween(prev, playerCoords))
		setWalking(true)
		dropCrumb(lng, lat)
		refreshStopGlow()
	}
	if (center) {
		map.easeTo({ center: playerCoords, duration: 400 })
	}
}

function setupMovementControls() {
	window.addEventListener('keydown', (e) => {
		if (!playerCoords) return
		if (
			['INPUT', 'TEXTAREA'].includes(
				document.activeElement.tagName
			)
		)
			return

		let deltaLng = 0
		let deltaLat = 0

		switch (e.key.toLowerCase()) {
			case 'w':
			case 'arrowup':
				deltaLat = STEP_SIZE
				break
			case 's':
			case 'arrowdown':
				deltaLat = -STEP_SIZE
				break
			case 'a':
			case 'arrowleft':
				deltaLng = -STEP_SIZE
				break
			case 'd':
			case 'arrowright':
				deltaLng = STEP_SIZE
				break
			default:
				return
		}

		e.preventDefault()
		// Keyboard walk = manual explore anywhere in the world: pause GPS
		// follow until recenter. Challenges stay campus-gated on tap.
		followMode = false
		setStatusChip('demo', 'Manual explore — 🎯 to follow GPS')
		movePlayerTo(
			[
				playerCoords[0] + deltaLng,
				playerCoords[1] + deltaLat,
			],
			{ center: true }
		)
	})
}

/**
 * GEOLOCATION — continuous watch (not one-shot), so the dot is actually live.
 */
function setBannerVisible(visible) {
	const banner = document.getElementById('offcampus-banner')
	if (banner) banner.style.display = visible ? 'block' : 'none'
}

/**
 * GPS FIX HANDLER — the single funnel for every position update, real or
 * simulated. The avatar + camera follow the player anywhere in the world;
 * the banner just says whether challenges are currently playable. The
 * campus gate is enforced when a stop is tapped, never on movement.
 */
function handleGpsFix(lng, lat, { accuracy = 0, source = 'real GPS' } = {}) {
	const inside = isInsideCampus(lng, lat)
	demoMode = false
	setBannerVisible(!inside)
	movePlayerTo([lng, lat], {
		center: followMode,
		accuracy,
	})
	const acc = Math.round(accuracy)
	if (inside) {
		setStatusChip(
			'live',
			`On campus (${source})${acc ? ` · ±${acc}m` : ''}`
		)
	} else {
		setStatusChip(
			'away',
			`Off campus (${source}) — visit Wits to play`
		)
	}
	lastInside = inside
}

function enterDemoMode(reason) {
	demoMode = true
	lastInside = true
	setBannerVisible(false)
	movePlayerTo([...CAMPUS_HOME], { center: true })
	setStatusChip(
		'demo',
		reason ?? 'GPS unavailable — demo at Great Hall (WASD to walk)'
	)
}

function startWatch() {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId)
		watchId = null
	}
	watchId = navigator.geolocation.watchPosition(
		(pos) => {
			handleGpsFix(
				pos.coords.longitude,
				pos.coords.latitude,
				{
					accuracy: pos.coords.accuracy ?? 0,
					source: 'real GPS',
				}
			)
		},
		(err) => {
			if (!demoMode && playerMarker) {
				// Had a fix and lost it: keep last dot, say so.
				setStatusChip(
					'demo',
					'GPS signal lost — showing last fix'
				)
				return
			}
			enterDemoMode(
				err.code === 1
					? 'Location blocked — demo at Great Hall (WASD to walk)'
					: 'GPS unavailable — demo at Great Hall (WASD to walk)'
			)
		},
		{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
	)
}

function initUserPosition() {
	setStatusChip('locating', 'Locating…')
	if (!('geolocation' in navigator)) {
		enterDemoMode(
			'No geolocation — demo at Great Hall (WASD to walk)'
		)
		return
	}
	startWatch()
}

// Dev-test panel (v4): real GPS vs simulated fixes.
function setupGeoPanel() {
	document.getElementById('btn-real-gps')?.addEventListener(
		'click',
		() => {
			if (!('geolocation' in navigator)) {
				setStatusChip(
					'away',
					'Geolocation not available — try a simulated fix'
				)
				return
			}
			followMode = true
			setStatusChip(
				'locating',
				'Requesting location permission…'
			)
			startWatch()
		}
	)
	document.getElementById('btn-sim-oncampus')?.addEventListener(
		'click',
		() => {
			if (watchId !== null && 'geolocation' in navigator) {
				navigator.geolocation.clearWatch(watchId)
				watchId = null
			}
			followMode = true
			handleGpsFix(SIM_ON_CAMPUS[0], SIM_ON_CAMPUS[1], {
				source: 'simulated',
			})
		}
	)
	document.getElementById('btn-sim-offcampus')?.addEventListener(
		'click',
		() => {
			if (watchId !== null && 'geolocation' in navigator) {
				navigator.geolocation.clearWatch(watchId)
				watchId = null
			}
			handleGpsFix(SIM_OFF_CAMPUS[0], SIM_OFF_CAMPUS[1], {
				source: 'simulated',
			})
		}
	)
}

/**
 * AUTHENTICATION SESSION CHECK
 */
async function checkAuthSession() {
	const container = document.getElementById('auth-nav-container')
	if (!container) return

	try {
		const res = await fetch(`${API_BASE}/me`, {
			method: 'GET',
			credentials: 'include',
		})
		if (res.ok) {
			const user = await res.json()
			currentUser = user
			container.innerHTML = `<div class="user-badge"><span>👤 ${user.name}</span><button id="logout-btn" class="logout-btn">Log Out</button></div>`
			document.getElementById('logout-btn')?.addEventListener(
				'click',
				async () => {
					await baSignOut()
					await clearBridgeSession()
					window.location.reload()
				}
			)
		} else {
			currentUser = null
			container.innerHTML = `<button onclick="openAuthDrawer()" class="auth-link">Sign In / Register</button>`
		}
	} catch (err) {
		currentUser = null
	}
}

/**
 * TRIVIA HANDLER — campus-gated on tap. Stops are visible and tappable
 * from anywhere in the world; attempting one requires being on campus.
 */
window.handleChallengeAttempt = async function (eventId) {
	if (!currentUser) {
		openAuthDrawer()
		return
	}

	if (!isInsideCampus(playerCoords[0], playerCoords[1])) {
		showGateModal()
		return
	}

	const [lat, lng] = [playerCoords[1], playerCoords[0]]

	try {
		const res = await fetch(
			`${API_BASE}/trivia/event/${eventId}?lat=${lat}&lng=${lng}`,
			{ credentials: 'include' }
		)
		if (res.status === 401) return openAuthDrawer()
		if (res.status === 403) {
			const data = await res.json()
			alert(
				`Too far! You are ${data.distance_meters}m away (need < ${data.radius_meters}m). Walk closer using WASD/Arrow keys!`
			)
			return
		}
		if (!res.ok)
			return alert('No active trivia available right now.')

		const trivia = await res.json()
		showTriviaModal(eventId, trivia)
	} catch (err) {
		alert('Error connecting to challenge server.')
	}
}

function showGateModal() {
	let modal = document.getElementById('trivia-modal')
	if (!modal) {
		modal = document.createElement('div')
		modal.id = 'trivia-modal'
		modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;`
		document.body.appendChild(modal)
	}

	modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center;">
      <div style="font-size: 2rem;">🏛️</div>
      <h3 style="margin: 8px 0;">On-campus challenge</h3>
      <p style="margin: 12px 0; color: #555;">You need to be on Wits campus to attempt this challenge. Come visit us to play!</p>
      <button style="margin-top: 4px; background: #2f9df0; color: #fff; border: none; border-radius: 6px; padding: 10px 24px; font-weight: bold; cursor: pointer;" onclick="document.getElementById('trivia-modal').remove()">Got it</button>
    </div>
  `
}

function showTriviaModal(eventId, trivia) {
	let modal = document.getElementById('trivia-modal')
	if (!modal) {
		modal = document.createElement('div')
		modal.id = 'trivia-modal'
		modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;`
		document.body.appendChild(modal)
	}

	const optionsHtml = trivia.options
		.map(
			(opt) => `
    <button style="display: block; width: 100%; margin: 8px 0; padding: 10px; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;"
            onclick="submitTriviaAnswer(${eventId}, ${trivia.question_id}, ${opt.option_id})">
      ${opt.body}
    </button>
  `
		)
		.join('')

	modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%;">
      <h3>🎯 Wits Campus Challenge</h3>
      <p style="margin: 12px 0;"><strong>${trivia.body}</strong></p>
      <div id="trivia-options">${optionsHtml}</div>
      <div id="trivia-result" style="margin-top: 12px;"></div>
      <button style="margin-top: 12px; background: none; border: none; color: #888; cursor: pointer;" onclick="document.getElementById('trivia-modal').remove()">Close</button>
    </div>
  `
}

window.submitTriviaAnswer = async function (eventId, questionId, optionId) {
	const [lat, lng] = [playerCoords[1], playerCoords[0]]

	try {
		const res = await fetch(`${API_BASE}/trivia/submit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify({
				event_id: eventId,
				question_id: questionId,
				selected_option_id: optionId,
				claimed_lat: lat,
				claimed_lng: lng,
			}),
		})

		const data = await res.json()
		const resultContainer = document.getElementById('trivia-result')
		if (resultContainer) {
			resultContainer.innerHTML =
				data.is_correct && data.location_verified
					? `<p style="color: #27ae60; font-weight: bold;">✅ Correct! +${data.points_awarded} points</p>`
					: `<p style="color: #c0392b; font-weight: bold;">❌ Challenge Failed.</p>`
		}
	} catch (err) {
		alert('Failed to submit answer.')
	}
}

/**
 * INITIALIZE WITS MAP ENGINE — world gamified map, live GPS dot, event
 * stops always visible, challenge attempts campus-gated on tap.
 */
async function initializeApp() {
	map = new maplibregl.Map({
		container: 'map',
		style: createCampusStyle(),
		center: CAMPUS_CAMERA.center,
		zoom: CAMPUS_CAMERA.zoom,
		pitch: CAMPUS_CAMERA.pitch,
		bearing: CAMPUS_CAMERA.bearing,
		minZoom: CAMPUS_MIN_ZOOM,
		maxZoom: CAMPUS_MAX_ZOOM,
		// NOTE: maxPitch must be set explicitly — MapLibre v3 defaults to
		// 60 and silently clamps anything steeper, which is why pitch 65
		// previously never visibly landed.
		minPitch: CAMPUS_MIN_PITCH,
		maxPitch: CAMPUS_MAX_PITCH,
		attributionControl: { compact: true },
	})

	map.addControl(
		new maplibregl.NavigationControl({ visualizePitch: true }),
		'bottom-right'
	)
	map.on('zoom', updateAccuracyCircle)
	// Dragging the map pauses follow (PoGo-style); 🎯 resumes it.
	map.on('dragstart', () => {
		if (!demoMode && followMode) {
			followMode = false
			setStatusChip('demo', 'Free look — 🎯 to follow GPS')
		}
	})

	// Soft pull-back: if the player free-looks far from campus and goes
	// idle, ease the camera home instead of stranding them elsewhere.
	clearPullback()
	map.on('movestart', clearPullback)
	map.on('moveend', armPullback)
	map.on('moveend', refreshFactStops)

	let tilted = true
	document.getElementById('btn-tilt')?.addEventListener('click', () => {
		tilted = !tilted
		map.easeTo({ pitch: tilted ? 72 : 60, duration: 600 })
	})
	document.getElementById('btn-reset')?.addEventListener('click', () => {
		tilted = true
		map.easeTo({ ...CAMPUS_CAMERA, duration: 700 })
	})

	map.on('load', async () => {
		// 0. Matte ground texture under the roads.
		addGroundTexture(map, 'water')
		// 1. Live GPS dot, geofenced (or clearly-labelled demo at Great Hall)
		setupMovementControls()
		setupGeoPanel()
		setupOrientation()
		startDayNightCycle(map)
		initUserPosition()

		// 2. Render Wits Campus Pins
		try {
			const buildings = await fetchCampusEvents()
			buildings.forEach((bld) => {
				const pinElement = createBuildingPinElement(bld)
				const popup = new maplibregl.Popup({
					offset: 25,
				}).setHTML(buildPopupContent(bld))

				const marker = new maplibregl.Marker({
					element: pinElement,
					anchor: 'bottom',
				})
					.setLngLat(bld.coordinates)
					.setPopup(popup)
					.addTo(map)
				stopMarkers.push({
					marker,
					el: pinElement.querySelector(
						'.pokestop-bob'
					),
					lng: bld.coordinates[0],
					lat: bld.coordinates[1],
				})
			})
			renderProximityCircles(buildings)
			refreshStopGlow()
			refreshFactStops()
		} catch (err) {
			console.error('Building pin error:', err)
		}

		// 2b. (World tiles render their own buildings; stops are the
		// tappable gameplay layer and are always rendered above.)

		// 3. Silent auth check
		await checkAuthSession().catch(() => {})

		// 4. 🎯 resumes GPS follow and flies to the player, wherever
		// they are in the world.
		document.getElementById('recenter-btn')?.addEventListener(
			'click',
			() => {
				followMode = true
				ensurePlayerMarker()
				map.flyTo({
					center: playerCoords,
					zoom: Math.max(map.getZoom(), 18.5),
					pitch: 72,
					bearing: 0,
					duration: 900,
				})
				if (!demoMode)
					setStatusChip(
						'live',
						'📍 Following GPS'
					)
			}
		)
	})
}

window.openAuthDrawer = () => {
	document.getElementById('auth-overlay')?.classList.add('open')
	document.getElementById('auth-drawer')?.classList.add('open')
}

window.closeAuthDrawer = () => {
	document.getElementById('auth-overlay')?.classList.remove('open')
	document.getElementById('auth-drawer')?.classList.remove('open')
}

document.addEventListener('DOMContentLoaded', initializeApp)
