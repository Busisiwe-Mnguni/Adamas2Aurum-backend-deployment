import { API_BASE } from './constants.js'
import { showToast, formatDT, esc } from './utils.js'
import { get_player_location } from './geolocation.js'

const EVENTS_API = `${API_BASE}/api/events`
const ME_API = `${API_BASE}/api/me`

const elLoading = document.getElementById('loading')
const elEmpty = document.getElementById('empty')
const elError = document.getElementById('error')
const elEventsContent = document.getElementById('events-content')
const elUserBadge = document.getElementById('user-badge')
const elConsoleLink = document.getElementById('console-link')
const btnLogout = document.getElementById('btn-logout')

// ── Trivia modal refs ──
const triviaOverlay = document.getElementById('trivia-overlay')
const triviaTitle = document.getElementById('trivia-title')
const triviaQuestion = document.getElementById('trivia-question')
const triviaOptions = document.getElementById('trivia-options')
const triviaResult = document.getElementById('trivia-result')
const triviaClose = document.getElementById('trivia-close')
let triviaTimer = null
let triviaStart = 0

// ── Map config (same as sign-in page) ──
const CONFIG = {
	CENTER: [-26.1905, 28.0285],
	ZOOM: 16.5,
	MIN_ZOOM: 16,
	MAX_ZOOM: 19,
	BOUNDS: [
		[-26.1945, 28.021],
		[-26.1835, 28.034],
	],
	TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
	TILE_ATTRIBUTION:
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}

const LANDMARKS = [
	{ name: 'Great Hall', coords: [-26.1925, 28.0305] },
	{ name: 'Solomon Mahlangu House', coords: [-26.1932, 28.0305] },
	{ name: 'William Cullen Library', coords: [-26.1918, 28.0298] },
	{ name: 'Wartenweiler Library', coords: [-26.1918, 28.0311] },
	{ name: 'The Matrix', coords: [-26.1905, 28.0315] },
	{ name: 'Umthombo Building', coords: [-26.1912, 28.0312] },
	{ name: 'John Moffat Building', coords: [-26.191, 28.0291] },
	{ name: 'Physics Building', coords: [-26.1926, 28.0315] },
	{ name: 'Origins Centre', coords: [-26.1936, 28.0328] },
	{ name: 'Wits Art Museum', coords: [-26.1942, 28.0331] },
	{ name: 'Wits Theatre', coords: [-26.1938, 28.0326] },
	{ name: 'Gate House', coords: [-26.1931, 28.0322] },
	{ name: 'Old Mutual Sports Hall', coords: [-26.1902, 28.0294] },
	{ name: 'Bidvest Stadium', coords: [-26.1882, 28.0287] },
	{ name: 'Commerce Library', coords: [-26.1908, 28.0248] },
	{ name: 'West Campus Village', coords: [-26.1888, 28.0235] },
]

const LANDMARK_ICON = L.divIcon({
	className: 'landmark-marker',
	html: '<div style="width:10px;height:10px;background:#999;border:2px solid #666;border-radius:50%;"></div>',
	iconSize: [14, 14],
	iconAnchor: [7, 7],
})

const EVENT_ICON = L.divIcon({
	className: 'event-marker',
	html: '<div style="width:16px;height:16px;background:#f1c40f;border:2px solid #0c2461;border-radius:50%;box-shadow:0 0 6px rgba(241,196,15,0.6);"></div>',
	iconSize: [20, 20],
	iconAnchor: [10, 10],
})

let map = null
let eventMarkers = []

function initMap() {
	map = L.map('map', {
		center: CONFIG.CENTER,
		zoom: CONFIG.ZOOM,
		minZoom: CONFIG.MIN_ZOOM,
		maxZoom: CONFIG.MAX_ZOOM,
		maxBounds: CONFIG.BOUNDS,
		maxBoundsViscosity: 1.0,
	})

	L.tileLayer(CONFIG.TILE_URL, {
		attribution: CONFIG.TILE_ATTRIBUTION,
		bounds: CONFIG.BOUNDS,
	}).addTo(map)

	LANDMARKS.forEach((lm) => {
		L.marker(lm.coords, { icon: LANDMARK_ICON })
			.addTo(map)
			.bindPopup(`<b>${esc(lm.name)}</b>`)
	})
}

// ── Auth check ──
async function checkAuth() {
	try {
		const res = await fetch(ME_API, { credentials: 'include' })
		if (!res.ok) {
			window.location.href = '/'
			return
		}
		const user = await res.json()
		elUserBadge.textContent = user.name
		elUserBadge.style.display = ''
		btnLogout.style.display = ''
		if (Array.isArray(user.roles) && user.roles.length) {
			elConsoleLink.style.display = ''
		}
		elEventsContent.classList.remove('hidden')
		initMap()
		loadEvents()
	} catch {
		window.location.href = '/'
	}
}

async function doLogout() {
	try {
		if (window.authClient) await window.authClient.signOut()
	} catch (err) {
		console.warn('[logout] signOut failed:', err.message)
	}
	window.location.href = '/'
}

btnLogout.addEventListener('click', doLogout)

// ── Load events and plot on map ──
async function loadEvents() {
	elLoading.classList.remove('hidden')
	elEmpty.classList.add('hidden')
	elError.classList.add('hidden')

	// Clear old event markers
	eventMarkers.forEach((m) => map.removeLayer(m))
	eventMarkers = []

	try {
		const res = await fetch(EVENTS_API, { credentials: 'include' })
		if (!res.ok) throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

		elLoading.classList.add('hidden')

		if (!data.length) {
			elEmpty.classList.remove('hidden')
			return
		}

		data.forEach((ev) => {
			const coords = [Number(ev.latitude), Number(ev.longitude)]

			// Radius circle
			const circle = L.circle(coords, {
				radius: ev.radius_meters,
				color: '#0c2461',
				fillColor: '#0c2461',
				fillOpacity: 0.08,
				weight: 1.5,
			}).addTo(map)

			// Event marker with popup
			const timeLabel = ev.starts_at
				? `From ${formatDT(ev.starts_at)}`
				: 'Always active'
			const lockLabel =
				ev.point_threshold > 0
					? `<p style="font-size:0.78rem;color:#666;">🔒 ${ev.point_threshold} pts to unlock</p>`
					: ''

			const popupHTML = `
				<div class="event-popup">
					<h3>${esc(ev.title)}</h3>
					<p>${esc(ev.description) || 'No description.'}</p>
					<div class="popup-meta">
						📍 ${ev.radius_meters}m radius &bull; ⚡ ${ev.point_reward} pts &bull; ${esc(timeLabel)}
					</div>
					${lockLabel}
					<button class="btn-attempt" data-event-id="${ev.event_id}">
						⚡ Attempt Challenge
					</button>
				</div>
			`

			const marker = L.marker(coords, { icon: EVENT_ICON })
				.addTo(map)
				.bindPopup(popupHTML, { maxWidth: 260 })

			marker.on('popupopen', () => {
				const btn = document.querySelector(
					`.btn-attempt[data-event-id="${ev.event_id}"]`
				)
				if (btn) {
					btn.addEventListener('click', () => {
						map.closePopup()
						startChallenge(ev.event_id)
					})
				}
			})

			eventMarkers.push(marker, circle)
		})

		console.log(`[map] Plotted ${data.length} events + ${LANDMARKS.length} landmarks`)
	} catch (err) {
		elLoading.classList.add('hidden')
		elError.textContent = `Could not load events — ${err.message}`
		elError.classList.remove('hidden')
	}
}

// ── Trivia challenge flow ──
function closeTrivia() {
	triviaOverlay.classList.add('hidden')
	triviaOptions.innerHTML = ''
	triviaResult.classList.add('hidden')
	triviaResult.textContent = ''
	triviaClose.hidden = true
	if (triviaTimer) {
		clearInterval(triviaTimer)
		triviaTimer = null
	}
}

triviaClose.addEventListener('click', closeTrivia)
triviaOverlay.addEventListener('click', (e) => {
	if (e.target === triviaOverlay) closeTrivia()
})

async function startChallenge(eventId) {
	showToast('Locating you on campus…', 'success')

	let coords
	try {
		coords = await get_player_location()
	} catch (err) {
		showToast(`Couldn't get your location — ${err.message}`, 'error')
		return
	}

	const [lat, lng] = coords
	let data
	try {
		const res = await fetch(`${EVENTS_API}/${eventId}/participate`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ latitude: lat, longitude: lng }),
		})
		const body = await res.json()
		if (!res.ok) throw new Error(body.error || `Server error ${res.status}`)
		data = body
	} catch (err) {
		showToast(err.message, 'error')
		return
	}

	renderTrivia(data, eventId)
}

function renderTrivia(data, eventId) {
	triviaTitle.textContent = data.event.title
	triviaQuestion.textContent = data.question.body
	triviaOptions.innerHTML = ''
	triviaResult.classList.add('hidden')
	triviaResult.textContent = ''
	triviaClose.hidden = true

	const timeLimit = data.question.time_limit_s || 0
	triviaStart = Date.now()

	data.options.forEach((opt) => {
		const btn = document.createElement('button')
		btn.className = 'btn btn-ghost'
		btn.type = 'button'
		btn.style.textAlign = 'left'
		btn.dataset.optionId = opt.option_id
		btn.textContent = opt.body
		btn.addEventListener('click', () => {
			if (triviaTimer) {
				clearInterval(triviaTimer)
				triviaTimer = null
			}
			const answerTime = Date.now() - triviaStart
			triviaOptions.querySelectorAll('button').forEach((b) => (b.disabled = true))
			submitAnswer(
				eventId,
				data.question.question_id,
				opt.option_id,
				data.location_check_id,
				answerTime,
				btn
			)
		})
		triviaOptions.appendChild(btn)
	})

	triviaOverlay.classList.remove('hidden')

	if (timeLimit > 0) {
		let remaining = timeLimit
		triviaResult.classList.remove('hidden')
		triviaResult.textContent = `⏱ ${remaining}s`
		triviaTimer = setInterval(() => {
			remaining -= 1
			if (remaining <= 0) {
				clearInterval(triviaTimer)
				triviaTimer = null
				triviaOptions.querySelectorAll('button').forEach((b) => (b.disabled = true))
				triviaResult.textContent = '⏰ Time up!'
				submitAnswer(
					eventId,
					data.question.question_id,
					null,
					data.location_check_id,
					timeLimit * 1000,
					null
				)
			} else {
				triviaResult.textContent = `⏱ ${remaining}s`
			}
		}, 1000)
	}
}

async function submitAnswer(eventId, questionId, optionId, locationCheckId, answerTimeMs, clickedBtn) {
	let data
	try {
		const res = await fetch(`${EVENTS_API}/${eventId}/answer`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				question_id: questionId,
				option_id: optionId,
				location_check_id: locationCheckId,
				answer_time_ms: answerTimeMs,
			}),
		})
		const body = await res.json()
		if (!res.ok) throw new Error(body.error || `Server error ${res.status}`)
		data = body
	} catch (err) {
		triviaResult.classList.remove('hidden')
		triviaResult.textContent = `⚠️ ${err.message}`
		triviaClose.hidden = false
		return
	}

	triviaOptions.querySelectorAll('button').forEach((b) => {
		if (data.correct_option_id != null && Number(b.dataset.optionId) === data.correct_option_id) {
			b.classList.remove('btn-ghost')
			b.classList.add('btn-primary')
		}
	})
	if (clickedBtn && !data.is_correct) {
		clickedBtn.classList.remove('btn-ghost')
		clickedBtn.classList.add('btn-danger')
	}

	let msg = data.is_correct
		? `✅ Correct! +${data.points_awarded} pts (total: ${data.new_points_total})`
		: `❌ Incorrect. (total: ${data.new_points_total})`
	if (data.card_awarded) msg += ` 🎴 New card: ${data.card_awarded.name}!`
	triviaResult.classList.remove('hidden')
	triviaResult.textContent = msg
	triviaClose.hidden = false

	if (data.is_correct) {
		setTimeout(loadEvents, 1200)
	}
}

checkAuth()
