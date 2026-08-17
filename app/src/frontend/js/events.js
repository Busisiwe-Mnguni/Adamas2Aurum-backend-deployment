import { API_BASE } from './constants.js'
import { showToast, buildCardBody } from './utils.js'
import { get_player_location } from './geolocation.js'

const AUTH_API = `${API_BASE}/api/auth`
const EVENTS_API = `${API_BASE}/api/events`

const elLoading = document.getElementById('loading')
const elEmpty = document.getElementById('empty')
const elError = document.getElementById('error')
const elEventList = document.getElementById('event-list')
const elLoginView = document.getElementById('login-view')
const elEventsContent = document.getElementById('events-content')
const elLoginForm = document.getElementById('login-form')
const elLoginError = document.getElementById('login-error')
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

async function checkAuth() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res.ok) {
			showLogin()
			return
		}
		const user = await res.json()
		elUserBadge.textContent = user.name
		elUserBadge.style.display = ''
		btnLogout.style.display = ''
		if (Array.isArray(user.roles) && user.roles.length) {
			elConsoleLink.style.display = ''
		}
		showEvents()
	} catch {
		showLogin()
	}
}

function showLogin() {
	elLoginView.classList.remove('hidden')
	elEventsContent.classList.add('hidden')
}

function showEvents() {
	elLoginView.classList.add('hidden')
	elEventsContent.classList.remove('hidden')
	loadEvents()
}

elLoginForm.addEventListener('submit', async (e) => {
	e.preventDefault()
	elLoginError.classList.add('hidden')

	const email = document.getElementById('login-email').value.trim()
	const pin = document.getElementById('login-pin').value

	if (!email || !pin) {
		elLoginError.textContent = 'Email and PIN are required.'
		elLoginError.classList.remove('hidden')
		return
	}

	document.getElementById('btn-login').disabled = true
	document.getElementById('btn-login').textContent = 'Signing in…'

	try {
		const res = await fetch(`${AUTH_API}/login`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, pin }),
		})
		const data = await res.json()
		if (!res.ok) throw new Error(data.error || 'Login failed')

		document.getElementById('login-pin').value = ''
		checkAuth()
	} catch (err) {
		elLoginError.textContent = err.message
		elLoginError.classList.remove('hidden')
	} finally {
		document.getElementById('btn-login').disabled = false
		document.getElementById('btn-login').textContent = 'Sign in'
	}
})

async function doLogout() {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
	elUserBadge.style.display = 'none'
	btnLogout.style.display = 'none'
	elConsoleLink.style.display = 'none'
	showLogin()
}

btnLogout.addEventListener('click', doLogout)

async function loadEvents() {
	elLoading.classList.remove('hidden')
	elEmpty.classList.add('hidden')
	elError.classList.add('hidden')
	elEventList.innerHTML = ''

	try {
		const res = await fetch(EVENTS_API, {
			credentials: 'include',
		})
		if (!res.ok)
			throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

		elLoading.classList.add('hidden')

		if (!data.length) {
			elEmpty.classList.remove('hidden')
			return
		}

		data.forEach((ev) =>
			elEventList.appendChild(buildPlayerCard(ev))
		)
	} catch (err) {
		elLoading.classList.add('hidden')
		elError.textContent = `Could not load events — ${err.message}`
		elError.classList.remove('hidden')
	}
}

function buildPlayerCard(ev) {
	const li = document.createElement('li')
	li.className = 'event-card'
	li.style.gridTemplateColumns = '1fr'

	const body = document.createElement('div')
	body.className = 'event-card-body'
	body.innerHTML = buildCardBody(ev)

	const btn = document.createElement('button')
	btn.className = 'btn btn-primary btn-sm'
	btn.type = 'button'
	btn.textContent = '⚡ Attempt Challenge'
	btn.addEventListener('click', () => startChallenge(ev.event_id))

	body.appendChild(btn)
	li.appendChild(body)

	return li
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
		showToast(
			`Couldn't get your location — ${err.message}`,
			'error'
		)
		return
	}

	const [lat, lng] = coords
	let data
	try {
		const res = await fetch(
			`${EVENTS_API}/${eventId}/participate`,
			{
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					latitude: lat,
					longitude: lng,
				}),
			}
		)
		const body = await res.json()
		if (!res.ok)
			throw new Error(
				body.error || `Server error ${res.status}`
			)
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
			triviaOptions
				.querySelectorAll('button')
				.forEach((b) => (b.disabled = true))
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
				triviaOptions
					.querySelectorAll('button')
					.forEach((b) => (b.disabled = true))
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

async function submitAnswer(
	eventId,
	questionId,
	optionId,
	locationCheckId,
	answerTimeMs,
	clickedBtn
) {
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
		if (!res.ok)
			throw new Error(
				body.error || `Server error ${res.status}`
			)
		data = body
	} catch (err) {
		triviaResult.classList.remove('hidden')
		triviaResult.textContent = `⚠️ ${err.message}`
		triviaClose.hidden = false
		return
	}

	triviaOptions.querySelectorAll('button').forEach((b) => {
		if (
			data.correct_option_id != null &&
			Number(b.dataset.optionId) === data.correct_option_id
		) {
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
