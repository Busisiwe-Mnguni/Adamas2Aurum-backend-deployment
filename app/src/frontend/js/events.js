import { API_BASE } from './constants.js'
import { get_player_location } from './geolocation.js'
import { distance } from './general.js'
import { updateAuthNav } from './auth-helpers.js'
import { get_location_for_challenge } from './qr-scanner.js'
import {
	createCampusStyle,
	CAMPUS_CAMERA,
	CAMPUS_MIN_ZOOM,
	CAMPUS_MAX_ZOOM,
	isInsideCampus,
	addGroundTexture,
} from './campus-style.js'

const AUTH_API = `${API_BASE}/api/auth`
const EVENT_API = `${API_BASE}/api/events`

// ── DOM ───────────────────────────────────────────────────────
const btnLogout = document.getElementById('btn-logout')
const btnSignin = document.getElementById('btn-signin')
const btnRecenter = document.getElementById('btn-recenter')
const elLoading = document.getElementById('map-loading')
const elError = document.getElementById('map-error')
const elSidebar = document.getElementById('map-sidebar')

// ── Map ───────────────────────────────────────────────────────
// World gamified base map — CartoDB Voyager vector tiles (free, no key).
// Shared with the main page via createCampusStyle().
const map = new maplibregl.Map({
	container: 'map',
	style: createCampusStyle(),
	center: CAMPUS_CAMERA.center,
	zoom: CAMPUS_CAMERA.zoom,
	pitch: 0, // flat for the events page — more PoGO-like
	bearing: 0,
	minZoom: 2,
	maxZoom: CAMPUS_MAX_ZOOM,
	attributionControl: { compact: true },
})

map.addControl(
	new maplibregl.NavigationControl({ showCompass: false }),
	'bottom-right'
)

// ── Auth ──────────────────────────────────────────────────────
let currentUser = null

async function checkAuth() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error()
		currentUser = await res.json()
		updateAuthNav(currentUser)
	} catch {
		currentUser = null
		updateAuthNav(null)
	}
}

btnLogout?.addEventListener('click', async () => {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
	window.location.href = '../index.html'
})

// ── Player location ───────────────────────────────────────────
let playerMarker = null
let playerLatLng = null

function startGeolocation() {
	if (!('geolocation' in navigator)) return

	navigator.geolocation.watchPosition(
		(pos) => {
			playerLatLng = [
				pos.coords.longitude,
				pos.coords.latitude,
			]

			if (!playerMarker) {
				const el = document.createElement('div')
				el.className = 'player-marker'
				playerMarker = new maplibregl.Marker({
					element: el,
					anchor: 'center',
				})
					.setLngLat(playerLatLng)
					.addTo(map)
			} else {
				playerMarker.setLngLat(playerLatLng)
			}
		},
		(err) => console.warn('Geolocation:', err.message),
		{ enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
	)
}

btnRecenter?.addEventListener('click', () => {
	if (playerLatLng) {
		map.flyTo({ center: playerLatLng, zoom: 17, duration: 800 })
	} else {
		map.flyTo({
			center: CAMPUS_CAMERA.center,
			zoom: CAMPUS_CAMERA.zoom,
			duration: 800,
		})
	}
})

// ── Event markers ─────────────────────────────────────────────
let activeMarkers = []
let activePopup = null

function clearMarkers() {
	activeMarkers.forEach((m) => m.remove())
	activeMarkers = []
	// Keep sidebar header, remove event cards
	const cards = elSidebar.querySelectorAll('.sidebar-event')
	cards.forEach((c) => c.remove())
}

function makeStopMarker(ev, inRange) {
	const el = document.createElement('div')
	el.className = 'pokestop-wrap'

	// Beam height based on in-range
	const beamH = inRange ? '36px' : '20px'

	el.innerHTML = `
		<div class="pokestop-beam" style="height:${beamH};"></div>
		<div class="pokestop-ring ${inRange ? '' : 'out-of-range'}"></div>
		<div class="pokestop-orb ${inRange ? 'in-range' : 'out-of-range'}">
			🏛️
		</div>
	`
	return el
}

function buildPopupHTML(ev, inRange, onCampus = false) {
	const rangePill = inRange
		? `<span class="meta-pill active">✓ In range</span>`
		: `<span class="meta-pill">Out of range</span>`

	// Stops are visible and tappable worldwide; playing needs campus.
	// On campus but outside the event radius → walk closer.
	// Anywhere else (or no fix yet) → campus gate message.
	const action = inRange
		? `<button class="popup-challenge-btn" onclick="window._challenge(${ev.event_id})">⚡ Attempt Challenge</button>`
		: onCampus
			? `<p class="popup-out-of-range">Walk closer to attempt this challenge.</p>`
			: `<p class="popup-out-of-range">🏛️ You need to be on Wits campus to attempt this challenge.</p>`

	return `
		<div class="popup-title">${ev.title}</div>
		<div class="popup-desc">${ev.description || 'No description.'}</div>
		<div class="popup-meta">
			<span class="meta-pill active">Active</span>
			${rangePill}
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
		</div>
		${action}
	`
}

// ── Load events ───────────────────────────────────────────────
async function loadEvents() {
	clearMarkers()
	elError.classList.add('hidden')

	try {
		const res = await fetch(EVENT_API, { cache: 'no-store' })
		if (!res.ok)
			throw new Error(`Server responded with ${res.status}`)
		const events = await res.json()

		elLoading.classList.add('hidden')

		if (!events.length) {
			elError.textContent =
				'No active events right now — check back later.'
			elError.classList.remove('hidden')
			return
		}

		// Try player location for range check
		let playerLoc = null
		try {
			playerLoc = await get_player_location()
		} catch {
			/* fine */
		}

		// Campus gate for taps: off-campus (or no fix) players see the
		// stops but get the gate message instead of a challenge button.
		const onCampus = playerLoc
			? isInsideCampus(playerLoc[1], playerLoc[0])
			: false

		for (const ev of events) {
			const lng = parseFloat(ev.longitude)
			const lat = parseFloat(ev.latitude)
			if (isNaN(lng) || isNaN(lat)) continue

			const inRange = playerLoc
				? distance(
						{
							latitude: playerLoc[0],
							longitude: playerLoc[1],
						},
						{
							latitude: lat,
							longitude: lng,
						}
					) <= ev.radius_meters
				: false

			// Pokéstop marker
			const el = makeStopMarker(ev, inRange)

			const marker = new maplibregl.Marker({
				element: el,
				anchor: 'bottom',
			})
				.setLngLat([lng, lat])
				.addTo(map)

			// Popup
			const popup = new maplibregl.Popup({
				offset: 20,
				closeButton: true,
			}).setHTML(buildPopupHTML(ev, inRange, onCampus))

			el.addEventListener('click', () => {
				activePopup?.remove()
				popup.setLngLat([lng, lat]).addTo(map)
				activePopup = popup
				// Highlight sidebar card
				document.querySelectorAll(
					'.sidebar-event'
				).forEach((c) => c.classList.remove('active'))
				document.querySelector(
					`.sidebar-event[data-id="${ev.event_id}"]`
				)?.classList.add('active')
			})

			activeMarkers.push(marker)
			addSidebarCard(ev, inRange, lng, lat)
		}
	} catch (err) {
		elLoading.classList.add('hidden')
		elError.textContent = `Could not load events — ${err.message}`
		elError.classList.remove('hidden')
	}
}

function addSidebarCard(ev, inRange, lng, lat) {
	const card = document.createElement('div')
	card.className = 'sidebar-event'
	card.dataset.id = ev.event_id

	card.innerHTML = `
		<div class="sidebar-event-title">${ev.title}</div>
		<div class="sidebar-event-meta">
			${
				inRange
					? `<span class="meta-pill active">✓ In range</span>`
					: `<span class="meta-pill">Out of range</span>`
			}
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
		</div>
	`

	card.addEventListener('click', () => {
		map.flyTo({ center: [lng, lat], zoom: 18, duration: 600 })
		document.querySelectorAll('.sidebar-event').forEach((c) =>
			c.classList.remove('active')
		)
		card.classList.add('active')
	})

	elSidebar.appendChild(card)
}

// ── Challenge handler ─────────────────────────────────────────
window._challenge = async function (eventId) {
	if (!currentUser) {
		window.location.href = '../index.html'
		return
	}

	const location = await get_location_for_challenge(eventId)
	if (!location) return

	const locationParams =
		location.mode === 'gps'
			? `lat=${location.lat}&lng=${location.lng}&accuracy=${location.accuracy}`
			: `qr_verified=true&location_check_id=${location.location_check_id}`

	try {
		const res = await fetch(
			`${API_BASE}/api/trivia/event/${eventId}?${locationParams}`,
			{ credentials: 'include' }
		)

		if (res.status === 401) {
			window.location.href = '../index.html'
			return
		}

		const data = await res.json()

		if (data.fallback_required) {
			alert(
				`GPS accuracy too poor (${data.reported_accuracy_m}m). Please scan the QR code at this location.`
			)
			return
		}

		if (!res.ok) {
			alert(
				data.error ||
					'No trivia challenge available for this event right now.'
			)
			return
		}

		activePopup?.remove()
		showTriviaModal(eventId, data)
	} catch {
		alert('Error connecting to the challenge server.')
	}
}

// ── Trivia modal ──────────────────────────────────────────────
function showTriviaModal(eventId, trivia) {
	document.getElementById('trivia-overlay')?.remove()

	const timeLimit = trivia.time_limit_s || 30
	const startTime = Date.now()

	const optionsHtml = trivia.options
		.map(
			(opt) => `
		<button data-option-id="${opt.option_id}" class="trivia-option-btn"
			style="display:block;width:100%;margin:6px 0;padding:10px 14px;
				border-radius:var(--radius);border:1px solid var(--border);
				background:var(--surface-2);color:var(--text);
				cursor:pointer;font-size:0.875rem;text-align:left;
				font-family:var(--font-body);transition:border-color 180ms ease,background 180ms ease;"
			onmouseover="this.style.borderColor='#0c2461';this.style.background='#f0f4ff'"
			onmouseout="this.style.borderColor='';this.style.background=''">
			${opt.body}
		</button>
	`
		)
		.join('')

	const overlay = document.createElement('div')
	overlay.id = 'trivia-overlay'
	overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.45);
		display:flex;align-items:center;justify-content:center;z-index:10000;`

	overlay.innerHTML = `
		<div style="background:var(--surface);border:1px solid var(--border);
			border-radius:var(--radius-lg);padding:1.75rem;max-width:420px;width:90%;
			box-shadow:0 8px 30px rgba(0,0,0,0.15);font-family:var(--font-body);">
			<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">
				<div style="font-family:var(--font-display);font-weight:700;font-size:1.05rem;color:var(--text);">
					🎯 Campus Challenge
				</div>
				<div id="trivia-timer" style="font-weight:700;font-size:1rem;color:var(--accent);min-width:2.5rem;text-align:right;">
					${timeLimit}s
				</div>
			</div>
			<div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:1rem;overflow:hidden;">
				<div id="trivia-timer-bar" style="height:100%;width:100%;background:var(--accent);transition:width 1s linear;border-radius:2px;"></div>
			</div>
			<p style="font-size:0.875rem;color:var(--text-dim);margin-bottom:1rem;line-height:1.5;">${trivia.body}</p>
			<div id="trivia-options">${optionsHtml}</div>
			<button id="trivia-close-btn"
				style="margin-top:1rem;background:none;border:none;color:var(--text-muted);
					cursor:pointer;font-size:0.8rem;text-decoration:underline;font-family:var(--font-body);">
				Close
			</button>
		</div>
	`

	document.body.appendChild(overlay)
	overlay.querySelector('#trivia-close-btn').addEventListener(
		'click',
		() => {
			clearInterval(timerInterval)
			overlay.remove()
		}
	)

	overlay.querySelector('#trivia-options').addEventListener(
		'click',
		(e) => {
			const btn = e.target.closest('.trivia-option-btn')
			if (!btn) return
			const optionId = parseInt(btn.dataset.optionId, 10)
			if (!optionId) return
			const elapsed = Date.now() - startTime
			clearInterval(timerInterval)
			overlay.querySelectorAll('.trivia-option-btn').forEach(
				(b) => (b.disabled = true)
			)
			window._submitAnswer(
				eventId,
				trivia.question_id,
				optionId,
				elapsed
			)
		}
	)

	let remaining = timeLimit
	const timerEl = overlay.querySelector('#trivia-timer')
	const timerBar = overlay.querySelector('#trivia-timer-bar')

	const timerInterval = setInterval(() => {
		remaining--
		timerEl.textContent = `${remaining}s`
		timerBar.style.width = `${(remaining / timeLimit) * 100}%`
		if (remaining <= 10) {
			timerEl.style.color = 'var(--danger)'
			timerBar.style.background = 'var(--danger)'
		}
		if (remaining <= 0) {
			clearInterval(timerInterval)
			overlay.querySelectorAll('.trivia-option-btn').forEach(
				(b) => (b.disabled = true)
			)
			window._submitAnswer(
				eventId,
				trivia.question_id,
				null,
				timeLimit * 1000
			)
		}
	}, 1000)
}

// ── Submit + result modal ─────────────────────────────────────
window._submitAnswer = async function (
	eventId,
	questionId,
	optionId,
	answerTimeMs
) {
	if (!optionId) {
		document.getElementById('trivia-overlay')?.remove()
		showResultModal({
			is_correct: false,
			timed_out: true,
			points_awarded: 0,
			answer_time_ms: answerTimeMs,
		})
		return
	}

	try {
		const res = await fetch(`${API_BASE}/api/trivia/submit`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				event_id: eventId,
				question_id: questionId,
				selected_option_id: optionId,
				answer_time_ms: answerTimeMs ?? 1500,
			}),
		})
		if (res.status === 401) {
			window.location.href = '../index.html'
			return
		}
		const data = await res.json()
		document.getElementById('trivia-overlay')?.remove()
		showResultModal({ ...data, answer_time_ms: answerTimeMs })
	} catch {
		alert('Failed to submit answer.')
	}
}

function showResultModal(data) {
	document.getElementById('result-overlay')?.remove()

	const {
		is_correct,
		timed_out,
		points_awarded = 0,
		correct_option_text,
		card_awarded,
		awarded_card,
		already_earned_card,
		answer_time_ms,
	} = data

	const timeSecs = answer_time_ms
		? (answer_time_ms / 1000).toFixed(1)
		: null
	const headerBg = is_correct ? '#f0fdf4' : '#fef2f2'
	const headerBorder = is_correct ? '#86efac' : '#fca5a5'
	const headerIcon = timed_out ? '⏱️' : is_correct ? '✅' : '❌'
	const headerText = timed_out
		? "Time's up!"
		: is_correct
			? 'Correct!'
			: 'Not quite!'
	const headerColor = is_correct ? '#166534' : '#991b1b'

	const pointsHtml =
		points_awarded > 0
			? `<div style="display:flex;align-items:center;justify-content:center;gap:0.5rem;
				background:#fefce8;border:1px solid #fde047;border-radius:8px;
				padding:0.6rem 1rem;margin-bottom:0.75rem;">
				<span style="font-size:1.1rem;">⚡</span>
				<span style="font-weight:700;color:#854d0e;font-size:1rem;">+${points_awarded} points earned</span>
				${timeSecs ? `<span style="font-size:0.78rem;color:#a16207;margin-left:0.25rem;">in ${timeSecs}s</span>` : ''}
			</div>`
			: ''

	const correctHtml = correct_option_text
		? `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">
				Correct answer: <strong style="color:var(--text);">${correct_option_text}</strong>
			</div>`
		: ''

	let cardHtml = ''
	if (card_awarded && awarded_card) {
		const rarityColours = {
			COMMON: '#64748b',
			RARE: '#2563eb',
			LEGENDARY: '#d97706',
		}
		const rc = rarityColours[awarded_card.rarity] ?? '#64748b'
		cardHtml = `
			<div style="border:2px solid ${rc};border-radius:10px;padding:0.85rem;
				margin-bottom:0.75rem;background:linear-gradient(135deg,#fff,#f8faff);">
				<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;
					text-transform:uppercase;color:${rc};margin-bottom:0.3rem;">🃏 New card earned!</div>
				<div style="display:flex;align-items:center;gap:0.75rem;">
					${
						awarded_card.image_url
							? `<img src="${awarded_card.image_url}" style="width:48px;height:48px;border-radius:6px;object-fit:cover;" />`
							: `<div style="width:48px;height:48px;border-radius:6px;background:var(--border);
							display:flex;align-items:center;justify-content:center;
							font-size:1.3rem;font-weight:700;color:var(--text-muted);">
							${(awarded_card.name || '?').charAt(0)}</div>`
					}
					<div>
						<div style="font-weight:700;font-size:0.95rem;color:var(--text);">${awarded_card.name}</div>
						<div style="font-size:0.78rem;font-weight:600;color:${rc};">${awarded_card.rarity} · ${awarded_card.category ?? ''}</div>
					</div>
				</div>
			</div>`
	} else if (already_earned_card) {
		cardHtml = `<div style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0.75rem;">
			🃏 You've already earned this event's card.
		</div>`
	}

	const overlay = document.createElement('div')
	overlay.id = 'result-overlay'
	overlay.style.cssText = `position:fixed;inset:0;background:rgba(0,0,0,0.5);
		display:flex;align-items:center;justify-content:center;z-index:10001;`

	overlay.innerHTML = `
		<div style="background:var(--surface);border:1px solid var(--border);
			border-radius:var(--radius-lg);max-width:400px;width:90%;
			box-shadow:0 8px 30px rgba(0,0,0,0.18);font-family:var(--font-body);overflow:hidden;">
			<div style="background:${headerBg};border-bottom:1px solid ${headerBorder};
				padding:1.25rem 1.5rem;text-align:center;">
				<div style="font-size:2rem;margin-bottom:0.25rem;">${headerIcon}</div>
				<div style="font-weight:800;font-size:1.15rem;color:${headerColor};">${headerText}</div>
				${
					timeSecs && !timed_out
						? `<div style="font-size:0.78rem;color:${headerColor};opacity:0.75;margin-top:0.2rem;">Answered in ${timeSecs}s</div>`
						: ''
				}
			</div>
			<div style="padding:1.25rem 1.5rem;">
				${pointsHtml}${correctHtml}${cardHtml}
				<button id="result-close" style="width:100%;background:var(--accent);color:#fff;
					border:none;border-radius:var(--radius);padding:0.6rem 1rem;
					font-size:0.875rem;font-weight:600;cursor:pointer;font-family:var(--font-body);">
					Continue
				</button>
			</div>
		</div>`

	document.body.appendChild(overlay)
	overlay.querySelector('#result-close').addEventListener('click', () =>
		overlay.remove()
	)
	overlay.addEventListener('click', (e) => {
		if (e.target === overlay) overlay.remove()
	})
}

// ── Boot ──────────────────────────────────────────────────────
await checkAuth()
startGeolocation()

// Wait for map to load before adding markers
map.on('load', () => {
	addGroundTexture(map)
	loadEvents()
})

setInterval(loadEvents, 30000)
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) loadEvents()
})
