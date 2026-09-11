import { API_BASE } from './constants.js'
import { get_player_location } from './geolocation.js'
import { distance } from './general.js'
import { updateAuthNav } from './auth-helpers.js'
import { get_location_for_challenge } from './qr-scanner.js'

const AUTH_API = `${API_BASE}/api/auth`
const EVENT_API = `${API_BASE}/api/events`

// ── DOM ──────────────────────────────────────────────────────
const btnLogout = document.getElementById('btn-logout')
const elLoading = document.getElementById('map-loading')
const elError = document.getElementById('map-error')
const elSidebar = document.getElementById('map-sidebar')

// ── Map ───────────────────────────────────────────────────────
const map = L.map('map', {
	center: [-26.1929, 28.0305],
	zoom: 16.5,
	minZoom: 14,
	maxZoom: 19,
})

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	attribution:
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
	maxZoom: 19,
}).addTo(map)

// ── Icons ─────────────────────────────────────────────────────
function makeEventIcon(inRange) {
	const bg = inRange ? '#0c2461' : '#7f8fa6'
	return L.divIcon({
		className: '',
		html: `<div style="
			width:30px;height:30px;
			border-radius:50% 50% 50% 0;
			transform:rotate(-45deg);
			background:${bg};
			border:2px solid #fff;
			box-shadow:0 2px 6px rgba(0,0,0,0.25);
			display:flex;align-items:center;justify-content:center;">
			<span style="transform:rotate(45deg);font-size:13px;">🏛️</span>
		</div>`,
		iconSize: [30, 30],
		iconAnchor: [15, 30],
		popupAnchor: [0, -32],
	})
}

const playerIcon = L.divIcon({
	className: '',
	html: `<div style="position:relative;width:36px;height:36px;">
		<div style="
			position:absolute;inset:0;border-radius:50%;
			background:rgba(12,36,97,0.25);
			animation:pulse-ring 1.8s infinite ease-out;">
		</div>
		<div style="
			position:absolute;top:2px;left:2px;
			width:32px;height:32px;
			border-radius:50% 50% 50% 0;
			transform:rotate(-45deg);
			background:#0c2461;
			border:2px solid #fff;
			box-shadow:0 3px 8px rgba(0,0,0,0.3);
			display:flex;align-items:center;justify-content:center;">
			<span style="transform:rotate(45deg);font-size:14px;">📍</span>
		</div>
	</div>`,
	iconSize: [36, 36],
	iconAnchor: [18, 36],
	popupAnchor: [0, -38],
})

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

btnLogout.addEventListener('click', async () => {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
	window.location.href = '/'
})

// ── Geolocation ───────────────────────────────────────────────
let playerMarker = null
let eventMarkers = []

function clearEventMarkers() {
	eventMarkers.forEach((marker) => marker.remove())
	eventMarkers = []
	elSidebar.innerHTML = ''
}

function startGeolocation() {
	if (!('geolocation' in navigator)) return
	navigator.geolocation.watchPosition(
		(pos) => {
			const ll = [pos.coords.latitude, pos.coords.longitude]
			if (!playerMarker) {
				playerMarker = L.marker(ll, {
					icon: playerIcon,
				})
					.addTo(map)
					.bindPopup('📍 You are here')
			} else {
				playerMarker.setLatLng(ll)
			}
		},
		(err) => console.warn('Geolocation:', err.message),
		{ enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
	)
}

// ── Load events ───────────────────────────────────────────────
async function loadEvents() {
	try {
		clearEventMarkers()
		elError.classList.add('hidden')

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

		let playerLoc = null
		try {
			playerLoc = await get_player_location()
		} catch {
			/* fine */
		}

		events.forEach((ev) => {
			const ll = [
				parseFloat(ev.latitude),
				parseFloat(ev.longitude),
			]
			// FIX: distance() expects two {latitude, longitude} objects, not 4 args
			const inRange = playerLoc
				? distance(
						{
							latitude: playerLoc[0],
							longitude: playerLoc[1],
						},
						{
							latitude: ll[0],
							longitude: ll[1],
						}
					) <= ev.radius_meters
				: false

			const marker = L.marker(ll, {
				icon: makeEventIcon(inRange),
			})
				.addTo(map)
				.bindPopup(buildPopup(ev, inRange), {
					maxWidth: 260,
				})

			eventMarkers.push(marker)
			addSidebarEvent(ev, inRange, marker)
		})
	} catch (err) {
		elLoading.classList.add('hidden')
		elError.textContent = `Could not load events — ${err.message}`
		elError.classList.remove('hidden')
	}
}

// ── Popup ─────────────────────────────────────────────────────
function buildPopup(ev, inRange) {
	const rangePill = inRange
		? `<span class="meta-pill active">✓ In range</span>`
		: `<span class="meta-pill">Out of range</span>`

	const actionHtml = inRange
		? `<button class="popup-challenge-btn" onclick="window._challenge(${ev.event_id})">⚡ Attempt Challenge</button>`
		: `<p class="popup-out-of-range">Walk closer to attempt this challenge.</p>`

	return `
		<div class="popup-title">${ev.title}</div>
		<div class="popup-desc">${ev.description || 'No description.'}</div>
		<div class="popup-meta">
			<span class="meta-pill active">Active</span>
			${rangePill}
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
		</div>
		${actionHtml}
	`
}

// ── Sidebar ───────────────────────────────────────────────────
function addSidebarEvent(ev, inRange, marker) {
	const card = document.createElement('div')
	card.className = 'sidebar-event'

	const rangePill = inRange
		? `<span class="meta-pill active">✓ In range</span>`
		: `<span class="meta-pill">Out of range</span>`

	card.innerHTML = `
		<div class="sidebar-event-title">${ev.title}</div>
		<div class="sidebar-event-meta">
			${rangePill}
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
		</div>
	`

	card.addEventListener('click', () => {
		map.setView(
			[parseFloat(ev.latitude), parseFloat(ev.longitude)],
			18,
			{ animate: true }
		)
		marker.openPopup()
		document.querySelectorAll('.sidebar-event').forEach((c) =>
			c.classList.remove('active')
		)
		card.classList.add('active')
	})

	elSidebar.appendChild(card)
}

// ── Rarity styling ────────────────────────────────────────────
const RARITY_STYLE = {
	COMMON: { bg: '#e5e7eb', fg: '#1f2937', label: 'Common' },
	UNCOMMON: { bg: '#bbf7d0', fg: '#14532d', label: 'Uncommon' },
	RARE: { bg: '#bfdbfe', fg: '#1e3a8a', label: 'Rare' },
	EPIC: { bg: '#e9d5ff', fg: '#581c87', label: 'Epic' },
	LEGENDARY: { bg: '#fde68a', fg: '#78350f', label: 'Legendary' },
}
function rarityBadge(rarity) {
	const s = RARITY_STYLE[rarity] || RARITY_STYLE.COMMON
	return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:600;letter-spacing:0.5px;background:${s.bg};color:${s.fg};text-transform:uppercase;">${s.label}</span>`
}
function escapeHtml(str) {
	if (str == null) return ''
	return String(str).replace(
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

// ── Challenge + trivia modal ──────────────────────────────────
// Module-level so _submitAnswer can attach the same location it
// was captured with — the submit endpoint requires claimed_lat/lng
// (or qr_verified + location_check_id) when location verification is
// enabled, otherwise it rejects the attempt with 400.
let currentChallengeLocation = null

window._challenge = async function (eventId) {
	if (!currentUser) {
		window.location.href = '/'
		return
	}

	// Get location — automatically falls back to QR scanner if GPS
	// accuracy is too poor (handled inside get_location_for_challenge)
	const location = await get_location_for_challenge(eventId)
	if (!location) return // user cancelled QR scanner
	currentChallengeLocation = location

	// Build query params depending on which verification path was used
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

		// Backend signals GPS too poor but QR not yet scanned —
		// this shouldn't normally happen since qr-scanner.js handles
		// it client-side first, but handle it defensively
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

		showTriviaModal(eventId, data)
	} catch {
		alert('Error connecting to the challenge server.')
	}
}

function showTriviaModal(eventId, trivia) {
	const startedAt = Date.now()
	const timeLimitMs = (trivia.time_limit_s || 30) * 1000

	document.getElementById('trivia-overlay')?.remove()

	const overlay = document.createElement('div')
	overlay.id = 'trivia-overlay'
	overlay.style.cssText = `
		position:fixed;inset:0;background:rgba(0,0,0,0.45);
		display:flex;align-items:center;justify-content:center;z-index:10000;
	`

	const optionsHtml = trivia.options
		.map(
			(opt) => `
		<button data-opt-id="${opt.option_id}" class="trivia-option-btn"
			style="
				display:block;width:100%;margin:6px 0;padding:10px 14px;
				border-radius:8px;border:1px solid var(--border,#e5e7eb);
				background:var(--surface-2,#f5f5f5);color:var(--text,#0f172a);
				cursor:pointer;font-size:0.875rem;text-align:left;
				font-family:var(--font-body,'Segoe UI',sans-serif);
				transition:border-color 180ms ease,background 180ms ease;">
			${escapeHtml(opt.body)}
		</button>
	`
		)
		.join('')

	overlay.innerHTML = `
		<div style="
			background:var(--surface,#fff);border:1px solid var(--border,#e5e7eb);
			border-radius:12px;padding:1.75rem;
			max-width:420px;width:90%;
			box-shadow:0 8px 30px rgba(0,0,0,0.15);
			font-family:var(--font-body,'Segoe UI',sans-serif);">
			<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">
				<div style="font-family:var(--font-display,'Segoe UI',sans-serif);font-weight:700;font-size:1.05rem;color:var(--text,#0f172a);">
					🎯 Campus Challenge
				</div>
				<div id="trivia-timer-text" style="font-variant-numeric:tabular-nums;font-weight:600;font-size:0.85rem;color:var(--text-dim,#475569);"></div>
			</div>
			<div style="height:6px;border-radius:999px;background:#e5e7eb;margin-bottom:1rem;overflow:hidden;">
				<div id="trivia-timer-bar" style="height:100%;background:#0c2461;border-radius:999px;transition:width 100ms linear,background-color 200ms;width:100%;"></div>
			</div>
			<p style="font-size:0.875rem;color:var(--text-dim,#475569);margin-bottom:1rem;line-height:1.5;">
				${escapeHtml(trivia.body)}
			</p>
			<div id="trivia-options">${optionsHtml}</div>
			<button id="trivia-close-btn"
				style="margin-top:1rem;background:none;border:none;color:var(--text-muted,#9ca3af);
					cursor:pointer;font-size:0.8rem;text-decoration:underline;">
				Close
			</button>
		</div>
	`
	document.body.appendChild(overlay)

	// Submit handler — guards against double-submit and auto-timeout both
	// racing with a late user click.
	let submitted = false
	const submit = async (optionId, timedOut) => {
		if (submitted) return
		submitted = true
		clearInterval(timerInterval)
		const elapsed = Date.now() - startedAt
		overlay.querySelectorAll('.trivia-option-btn').forEach(
			(b) => (b.disabled = true)
		)
		await window._submitAnswer(
			eventId,
			trivia.question_id,
			optionId,
			{
				timed_out: timedOut,
				elapsed_ms: elapsed,
			}
		)
	}

	overlay.querySelectorAll('.trivia-option-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			submit(Number(btn.dataset.optId), false)
		})
		btn.addEventListener('mouseover', () => {
			if (!btn.disabled) {
				btn.style.borderColor = '#0c2461'
				btn.style.background = '#f0f4ff'
			}
		})
		btn.addEventListener('mouseout', () => {
			btn.style.borderColor = ''
			btn.style.background = ''
		})
	})
	overlay.querySelector('#trivia-close-btn').addEventListener(
		'click',
		() => {
			clearInterval(timerInterval)
			overlay.remove()
		}
	)

	// Countdown — ticks every 100 ms for a smooth bar; shifts color from
	// deep blue → amber (<10 s) → red (<5 s), auto-submits at zero.
	const barEl = overlay.querySelector('#trivia-timer-bar')
	const textEl = overlay.querySelector('#trivia-timer-text')
	const tick = () => {
		const elapsed = Date.now() - startedAt
		const remaining = Math.max(0, timeLimitMs - elapsed)
		const pct = (remaining / timeLimitMs) * 100
		barEl.style.width = pct + '%'
		textEl.textContent = Math.ceil(remaining / 1000) + 's'
		if (remaining < 5000) {
			barEl.style.background = '#dc2626'
			textEl.style.color = '#dc2626'
		} else if (remaining < 10000) {
			barEl.style.background = '#f59e0b'
			textEl.style.color = '#b45309'
		} else {
			barEl.style.background = '#0c2461'
			textEl.style.color = ''
		}
		if (remaining <= 0) {
			submit(null, true)
		}
	}
	tick()
	const timerInterval = setInterval(tick, 100)
}

window._submitAnswer = async function (
	eventId,
	questionId,
	optionId,
	opts = {}
) {
	const { timed_out = false, elapsed_ms = 0 } = opts
	const loc = currentChallengeLocation

	const body = {
		event_id: eventId,
		question_id: questionId,
		answer_time_ms: elapsed_ms,
		timed_out: !!timed_out,
	}
	if (!timed_out) body.selected_option_id = optionId

	// Forward the same location we verified with at open time — the
	// submit endpoint rejects attempts missing claimed_lat/lng when
	// location verification is enabled.
	if (loc) {
		if (loc.mode === 'qr') {
			body.qr_verified = true
			body.location_check_id = loc.location_check_id
		} else {
			body.claimed_lat = loc.lat
			body.claimed_lng = loc.lng
		}
	}

	try {
		const res = await fetch(`${API_BASE}/api/trivia/submit`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		if (res.status === 401) {
			alert('Session expired — please sign in again.')
			window.location.href = '../index.html'
			return
		}
		const data = await res.json()
		showResultModal(data)
	} catch {
		alert('Failed to submit answer.')
	}
}

function showResultModal(data) {
	const overlay = document.getElementById('trivia-overlay')
	if (!overlay) return

	let statusIcon, statusText, statusColor
	if (data.timed_out) {
		statusIcon = '⏰'
		statusText = "Time's up!"
		statusColor = '#b45309'
	} else if (data.location_verified === false) {
		statusIcon = '📍'
		statusText = 'Too far away — attempt did not count.'
		statusColor = '#b45309'
	} else if (data.is_correct) {
		statusIcon = '✅'
		statusText = 'Correct!'
		statusColor = '#16a34a'
	} else {
		statusIcon = '❌'
		statusText = 'Incorrect.'
		statusColor = '#dc2626'
	}

	const elapsedSec = ((data.answer_time_ms || 0) / 1000).toFixed(1)
	const limitSec = data.time_limit_s || 30

	let cardBlock = ''
	if (data.card_awarded && data.awarded_card) {
		const c = data.awarded_card
		cardBlock = `
			<div style="margin-top:1rem;padding:0.85rem 1rem;border-radius:8px;background:#f8fafc;border:1px solid #e2e8f0;">
				<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:4px;">Card awarded</div>
				<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
					<div style="font-weight:600;color:var(--text,#0f172a);">${escapeHtml(c.name)}</div>
					${rarityBadge(c.rarity)}
				</div>
			</div>
		`
	} else if (data.already_earned_card) {
		cardBlock = `<div style="margin-top:0.75rem;font-size:0.8rem;color:var(--text-muted,#9ca3af);">You've already earned this event's card.</div>`
	}

	const correctHtml = data.correct_option_text
		? `<div style="margin-top:0.75rem;padding:0.6rem 0.85rem;border-radius:8px;background:#ecfdf5;border:1px solid #bbf7d0;font-size:0.85rem;color:#065f46;"><strong>Correct answer:</strong> ${escapeHtml(data.correct_option_text)}</div>`
		: ''

	const inner = overlay.firstElementChild
	inner.innerHTML = `
		<div style="text-align:center;margin-bottom:1rem;">
			<div style="font-size:2.5rem;line-height:1;">${statusIcon}</div>
			<div style="font-weight:700;font-size:1.1rem;color:${statusColor};margin-top:0.5rem;">${statusText}</div>
		</div>
		${correctHtml}
		<div style="margin-top:1rem;border-top:1px solid var(--border,#e5e7eb);padding-top:0.75rem;">
			<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.85rem;color:var(--text-dim,#475569);">
				<span>Time taken</span>
				<span style="font-variant-numeric:tabular-nums;font-weight:600;color:var(--text,#0f172a);">
					${elapsedSec}s <span style="color:var(--text-muted,#9ca3af);font-weight:400;">/ ${limitSec}s</span>
				</span>
			</div>
			<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:0.85rem;color:var(--text-dim,#475569);">
				<span>Points earned</span>
				<span style="font-weight:600;color:${data.points_awarded > 0 ? '#16a34a' : '#9ca3af'};">
					${data.points_awarded > 0 ? '+' + data.points_awarded : '0'}
				</span>
			</div>
		</div>
		${cardBlock}
		<div style="text-align:center;margin-top:1.25rem;">
			<button id="result-close-btn"
				style="padding:0.55rem 1.4rem;border-radius:8px;border:1px solid var(--border,#e5e7eb);
					background:var(--surface-2,#f5f5f5);color:var(--text,#0f172a);font-weight:600;
					font-size:0.85rem;cursor:pointer;">
				Continue
			</button>
		</div>
	`
	inner.querySelector('#result-close-btn').addEventListener('click', () =>
		overlay.remove()
	)
}

// ── Boot ──────────────────────────────────────────────────────
await checkAuth()
startGeolocation()
await loadEvents()

// Refresh events when the admin creates/updates them without requiring a
// manual page reload.
setInterval(loadEvents, 30000)
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) loadEvents()
})
