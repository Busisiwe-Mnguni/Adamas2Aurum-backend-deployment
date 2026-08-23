// FIX: import api_base, showToast and toDatetimeLocal from utils —
// they were used but never defined in this file, causing crashes on
// form submit and delete.
import { api_base, showToast, toDatetimeLocal, buildCardBody } from './utils.js'
import { API_BASE } from './constants.js'

const AUTHOR_ROLES = ['SUPER_ADMIN', 'EVENT_AUTHOR']
const AUTH_API = `${API_BASE}/api/auth`

const elLoginView = document.getElementById('login-view')
const elLoginForm = document.getElementById('login-form')
const elLoginError = document.getElementById('login-error')
const elAccessDenied = document.getElementById('access-denied')
const elConsole = document.getElementById('console-content')

const elLoading = document.getElementById('loading')
const elEmpty = document.getElementById('empty')
const elListError = document.getElementById('list-error')
const elEventList = document.getElementById('event-list')
const elEventCount = document.getElementById('event-count')

const viewList = document.getElementById('view-list')
const viewForm = document.getElementById('view-form')
const formHeading = document.getElementById('form-heading')
const eventForm = document.getElementById('event-form')
const editIdInput = document.getElementById('edit-id')
const btnNew = document.getElementById('btn-new')
const btnCancel = document.getElementById('btn-cancel')
const btnSubmit = document.getElementById('btn-submit')

const modalOverlay = document.getElementById('modal-overlay')
const modalBody = document.getElementById('modal-body')
const modalCancel = document.getElementById('modal-cancel')
const modalConfirm = document.getElementById('modal-confirm')

const elUserBadge = document.getElementById('user-badge')
const btnLogout = document.getElementById('btn-logout')
const btnLogoutDenied = document.getElementById('btn-logout-denied')

const f = (id) => document.getElementById(id)

async function doLogout() {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
	elConsole.classList.add('hidden')
	elAccessDenied.classList.add('hidden')
	elUserBadge.style.display = 'none'
	btnLogout.style.display = 'none'
	elLoginView.classList.remove('hidden')
}

btnLogout.addEventListener('click', doLogout)
btnLogoutDenied.addEventListener('click', doLogout)

elLoginForm.addEventListener('submit', async (e) => {
	e.preventDefault()
	elLoginError.classList.add('hidden')

	const email = f('login-email').value.trim()
	const pin = f('login-pin').value

	if (!email || !pin) {
		elLoginError.textContent = 'Email and PIN are required.'
		elLoginError.classList.remove('hidden')
		return
	}

	f('btn-login').disabled = true
	f('btn-login').textContent = 'Signing in…'

	try {
		const res = await fetch(`${AUTH_API}/login`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, pin }),
		})
		const data = await res.json()
		if (!res.ok) throw new Error(data.error || 'Login failed')

		elLoginView.classList.add('hidden')
		f('login-pin').value = ''
		checkAccess()
	} catch (err) {
		elLoginError.textContent = err.message
		elLoginError.classList.remove('hidden')
	} finally {
		f('btn-login').disabled = false
		f('btn-login').textContent = 'Sign in'
	}
})

async function checkAccess() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error('Not authenticated')
		const user = await res.json()

		const hasRole = (user.roles ?? []).some((r) =>
			AUTHOR_ROLES.includes(r)
		)
		if (!hasRole) {
			elAccessDenied.classList.remove('hidden')
			return
		}

		elUserBadge.textContent = user.name
		elUserBadge.style.display = ''
		btnLogout.style.display = ''
		elConsole.classList.remove('hidden')
		loadEvents()
	} catch {
		elLoginView.classList.remove('hidden')
	}
}

function showList() {
	viewList.classList.remove('hidden')
	viewForm.classList.add('hidden')
}

function showForm() {
	viewList.classList.add('hidden')
	viewForm.classList.remove('hidden')
}

async function loadEvents() {
	elLoading.classList.remove('hidden')
	elEmpty.classList.add('hidden')
	elListError.classList.add('hidden')
	elEventList.innerHTML = ''
	elEventCount.textContent = 'Loading…'

	try {
		const res = await fetch(`${api_base}?all=true`, {
			credentials: 'include',
		})
		if (!res.ok)
			throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

		elLoading.classList.add('hidden')

		if (!data.length) {
			elEmpty.classList.remove('hidden')
			elEventCount.textContent = '0 events'
			return
		}

		elEventCount.textContent = `${data.length} event${data.length !== 1 ? 's' : ''}`
		data.forEach((ev) =>
			elEventList.appendChild(buildAdminCard(ev))
		)
	} catch (err) {
		elLoading.classList.add('hidden')
		elListError.textContent = `Could not load events — ${err.message}`
		elListError.classList.remove('hidden')
	}
}

function buildAdminCard(ev) {
	const li = document.createElement('li')
	li.className = 'event-card'
	li.dataset.id = ev.event_id

	li.innerHTML = `
    <div class="event-card-body">${buildCardBody(ev)}</div>
    <div class="event-card-actions">
      <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
      <button class="btn btn-sm" data-action="delete"
        style="color:var(--danger);border-color:#5a2a2a;background:var(--danger-dim);">
        Delete
      </button>
    </div>
  `

	li.querySelector('[data-action="edit"]').addEventListener('click', () =>
		openEditForm(ev)
	)
	li.querySelector('[data-action="delete"]').addEventListener(
		'click',
		() => openModal(ev.title, ev.event_id)
	)

	return li
}

btnNew.addEventListener('click', () => {
	resetForm()
	formHeading.textContent = 'New Event'
	btnSubmit.textContent = 'Save Event'
	showForm()
})

btnCancel.addEventListener('click', () => {
	resetForm()
	showList()
	loadEvents()
})

function openEditForm(ev) {
	resetForm()
	formHeading.textContent = 'Edit Event'
	btnSubmit.textContent = 'Save Changes'

	editIdInput.value = ev.event_id
	f('f-title').value = ev.title ?? ''
	f('f-description').value = ev.description ?? ''
	f('f-latitude').value = ev.latitude ?? ''
	f('f-longitude').value = ev.longitude ?? ''
	f('f-radius').value = ev.radius_meters ?? ''
	f('f-threshold').value = ev.point_threshold ?? 0
	f('f-reward').value = ev.point_reward ?? 10
	f('f-cooldown').value = ev.attempt_cooldown_s ?? 86400
	f('f-max-attempts').value = ev.max_attempts_per_window ?? 1
	f('f-interval').value = ev.repeat_interval ?? ''
	f('f-active').checked = !!ev.is_active
	f('f-starts').value = toDatetimeLocal(ev.starts_at)
	f('f-ends').value = toDatetimeLocal(ev.ends_at)

	showForm()
}

eventForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const id = editIdInput.value

	const payload = {
		title: f('f-title').value.trim(),
		description: f('f-description').value.trim() || null,
		latitude: parseFloat(f('f-latitude').value),
		longitude: parseFloat(f('f-longitude').value),
		radius_meters: parseInt(f('f-radius').value, 10),
		point_threshold: parseInt(f('f-threshold').value, 10) || 0,
		point_reward: parseInt(f('f-reward').value, 10) || 10,
		attempt_cooldown_s:
			parseInt(f('f-cooldown').value, 10) || 86400,
		max_attempts_per_window:
			parseInt(f('f-max-attempts').value, 10) || 1,
		repeat_interval: f('f-interval').value
			? parseInt(f('f-interval').value, 10)
			: null,
		starts_at: f('f-starts').value || null,
		ends_at: f('f-ends').value || null,
		is_active: f('f-active').checked,
	}

	if (!payload.title) {
		showToast('Title is required.', 'error')
		return
	}
	if (isNaN(payload.latitude) || isNaN(payload.longitude)) {
		showToast('Valid latitude and longitude are required.', 'error')
		return
	}
	if (!payload.radius_meters || payload.radius_meters < 10) {
		showToast('Radius must be at least 10 metres.', 'error')
		return
	}

	btnSubmit.disabled = true
	btnSubmit.textContent = 'Saving…'

	try {
		const url = id ? `${api_base}/${id}` : api_base
		const method = id ? 'PUT' : 'POST'

		const res = await fetch(url, {
			method,
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		showToast(id ? 'Event updated.' : 'Event created.', 'success')
		resetForm()
		showList()
		loadEvents()
	} catch (err) {
		showToast(err.message, 'error')
	} finally {
		btnSubmit.disabled = false
		btnSubmit.textContent = editIdInput.value
			? 'Save Changes'
			: 'Save Event'
	}
})

let pendingDeleteId = null

function openModal(title, id) {
	pendingDeleteId = id
	modalBody.textContent = `"${title}" will be permanently removed from the map.`
	modalOverlay.classList.remove('hidden')
}

function closeModal() {
	pendingDeleteId = null
	modalOverlay.classList.add('hidden')
}

modalCancel.addEventListener('click', closeModal)
modalOverlay.addEventListener('click', (e) => {
	if (e.target === modalOverlay) closeModal()
})

modalConfirm.addEventListener('click', async () => {
	if (!pendingDeleteId) return
	const id = pendingDeleteId
	closeModal()

	try {
		const res = await fetch(`${api_base}/${id}`, {
			method: 'DELETE',
			credentials: 'include',
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		const card = elEventList.querySelector(`[data-id="${id}"]`)
		if (card) card.remove()

		const remaining =
			elEventList.querySelectorAll('.event-card').length
		elEventCount.textContent = `${remaining} event${remaining !== 1 ? 's' : ''}`
		if (!remaining) elEmpty.classList.remove('hidden')

		showToast('Event deleted.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
})

function resetForm() {
	eventForm.reset()
	editIdInput.value = ''
	f('f-active').checked = true
}

checkAccess()

// ============================================================
// User Story 6 — Question authoring panel.
//
// This entire section is ADDITIVE: it does not modify the event form,
// the event CRUD handlers, or any existing function above it. It hooks
// into the existing edit/new/cancel flow via additional (parallel)
// listeners so it merges cleanly with other in-progress branches.
// ============================================================
const qPanel = document.getElementById('questions-panel')
const qList = document.getElementById('question-list')
const qCount = document.getElementById('question-count')
const qLoading = document.getElementById('question-loading')
const qEmpty = document.getElementById('question-empty')
const qForm = document.getElementById('question-form')
const qEditIdInput = document.getElementById('q-edit-id')
const qTextInput = document.getElementById('q-text')
const qTypeSelect = document.getElementById('q-type')
const qCorrectInput = document.getElementById('q-correct')
const qOptionList = document.getElementById('q-option-list')
const qOptionsField = document.getElementById('q-options-field')
const qOptionsContainer = document.getElementById('q-options-container')
const qAddOptionBtn = document.getElementById('q-add-option')
const qCancelBtn = document.getElementById('q-cancel')
const qSubmitBtn = document.getElementById('q-submit')
const qModalOverlay = document.getElementById('q-modal-overlay')
const qModalBody = document.getElementById('q-modal-body')
const qModalCancel = document.getElementById('q-modal-cancel')
const qModalConfirm = document.getElementById('q-modal-confirm')

let currentEventId = null
let pendingQuestionDeleteId = null

function escapeHtml(str) {
	return String(str ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
}

// Show the panel + load questions when an event is opened for editing.
// Registered on elEventList (the <ul>) so it works for dynamically-created
// cards; fires in the bubble phase AFTER the existing openEditForm
// listener has already shown the edit form.
elEventList.addEventListener('click', (e) => {
	const editBtn = e.target.closest('[data-action="edit"]')
	if (!editBtn) return
	const card = editBtn.closest('.event-card')
	const id = card?.dataset.id
	if (!id) return
	currentEventId = id
	qPanel.hidden = false
	loadQuestions(id)
})

// Brand-new events have no id yet, so hide the questions panel.
btnNew.addEventListener('click', () => {
	currentEventId = null
	qPanel.hidden = true
	resetQuestionForm()
})

// Leaving the edit view hides the panel too.
btnCancel.addEventListener('click', () => {
	currentEventId = null
	qPanel.hidden = true
	resetQuestionForm()
})

async function loadQuestions(eventId) {
	qLoading.classList.remove('hidden')
	qEmpty.classList.add('hidden')
	qList.innerHTML = ''
	qCount.textContent = 'Loading…'

	try {
		const res = await fetch(
			`${API_BASE}/api/events/${eventId}/questions`,
			{ credentials: 'include' }
		)
		if (!res.ok)
			throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

		qLoading.classList.add('hidden')
		qCount.textContent = `${data.length} question${data.length !== 1 ? 's' : ''}`

		if (!data.length) {
			qEmpty.classList.remove('hidden')
			return
		}

		qList.append(...data.map(buildQuestionItem))
	} catch (err) {
		qLoading.classList.add('hidden')
		qCount.textContent = 'Could not load questions'
		showToast(err.message, 'error')
	}
}

function buildQuestionItem(q) {
	const li = document.createElement('li')
	li.className = 'q-item'
	li.dataset.id = q.id

	const typeLabel = String(q.type)
		.replace(/_/g, ' ')
		.toLowerCase()
	let meta = typeLabel
	if (q.type === 'MULTIPLE_CHOICE' && Array.isArray(q.options)) {
		meta += ` · ${q.options.length} options`
	}

	li.innerHTML = `
		<div>
			<div class="q-item-text">${escapeHtml(q.text)}</div>
			<div class="q-item-meta">${escapeHtml(meta)}</div>
		</div>
		<div class="q-item-actions">
			<button class="btn btn-ghost btn-sm" data-q-action="edit">Edit</button>
			<button class="btn btn-sm" data-q-action="delete"
				style="color:var(--danger);border-color:#5a2a2a;background:var(--danger-dim);">
				Delete
			</button>
		</div>
	`

	li.querySelector('[data-q-action="edit"]').addEventListener(
		'click',
		() => openQuestionEdit(q)
	)
	li.querySelector('[data-q-action="delete"]').addEventListener(
		'click',
		() => openQuestionDeleteModal(q)
	)

	return li
}

function collectOptions() {
	return [...qOptionsContainer.querySelectorAll('.q-option-row input')]
		.map((i) => i.value.trim())
		.filter((v) => v.length)
}

function refreshCorrectDatalist(type) {
	qOptionList.innerHTML = ''
	if (type === 'MULTIPLE_CHOICE') {
		collectOptions().forEach((v) => {
			const o = document.createElement('option')
			o.value = v
			qOptionList.appendChild(o)
		})
	} else if (type === 'TRUE_FALSE') {
			;['true', 'false'].forEach((v) => {
				const o = document.createElement('option')
				o.value = v
				qOptionList.appendChild(o)
			})
	}
}

function updateCorrectPlaceholder(type) {
	if (type === 'TRUE_FALSE') {
		qCorrectInput.placeholder = "'true' or 'false'"
	} else if (type === 'FILL_BLANK') {
		qCorrectInput.placeholder = 'Expected answer text'
	} else {
		qCorrectInput.placeholder = 'Pick from the options'
	}
}

function addOptionRow(value = '') {
	const row = document.createElement('div')
	row.className = 'q-option-row'

	const input = document.createElement('input')
	input.type = 'text'
	input.value = value
	input.placeholder = 'Option text'
	input.dataset.role = 'q-option-input'

	const removeBtn = document.createElement('button')
	removeBtn.type = 'button'
	removeBtn.className = 'btn btn-ghost btn-sm'
	removeBtn.textContent = '✕'
	removeBtn.dataset.role = 'q-option-remove'

	row.append(input, removeBtn)
	qOptionsContainer.appendChild(row)
}

// Delegated handlers for the dynamic option rows.
qOptionsContainer.addEventListener('input', (e) => {
	if (e.target.dataset.role !== 'q-option-input') return
	refreshCorrectDatalist('MULTIPLE_CHOICE')
})
qOptionsContainer.addEventListener('click', (e) => {
	if (e.target.dataset.role !== 'q-option-remove') return
	e.target.closest('.q-option-row')?.remove()
	refreshCorrectDatalist('MULTIPLE_CHOICE')
})

qAddOptionBtn.addEventListener('click', () => {
	addOptionRow()
	refreshCorrectDatalist('MULTIPLE_CHOICE')
})

qTypeSelect.addEventListener('change', () => {
	const type = qTypeSelect.value
	if (type === 'MULTIPLE_CHOICE') {
		qOptionsField.classList.remove('hidden')
		if (!qOptionsContainer.children.length) {
			addOptionRow()
			addOptionRow()
		}
	} else {
		qOptionsField.classList.add('hidden')
	}
	refreshCorrectDatalist(type)
	updateCorrectPlaceholder(type)
})

function syncOptionsForType(type, existing) {
	if (type === 'MULTIPLE_CHOICE') {
		qOptionsField.classList.remove('hidden')
		qOptionsContainer.innerHTML = ''
		const opts =
			Array.isArray(existing) && existing.length
				? existing
				: ['', '']
		opts.forEach((v) => addOptionRow(v))
	} else {
		qOptionsField.classList.add('hidden')
		qOptionsContainer.innerHTML = ''
	}
	refreshCorrectDatalist(type)
	updateCorrectPlaceholder(type)
}

function openQuestionEdit(q) {
	resetQuestionForm()
	qEditIdInput.value = q.id
	qTextInput.value = q.text ?? ''
	qTypeSelect.value = q.type
	// correctAnswer is intentionally NOT pre-filled: the list endpoint
	// deliberately omits it (kept hidden from players). The author
	// re-enters it on save.
	qCorrectInput.value = ''
	syncOptionsForType(q.type, q.options)
	qCorrectInput.placeholder = 'Re-enter the correct answer'
	qSubmitBtn.textContent = 'Save Changes'
}

function resetQuestionForm() {
	qForm.reset()
	qEditIdInput.value = ''
	qOptionsContainer.innerHTML = ''
	qOptionList.innerHTML = ''
	qSubmitBtn.textContent = 'Save Question'
	// Default type is MULTIPLE_CHOICE (first <option>); seed two empty rows.
	syncOptionsForType('MULTIPLE_CHOICE', null)
}

qCancelBtn.addEventListener('click', resetQuestionForm)

qForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const id = qEditIdInput.value
	const type = qTypeSelect.value
	const text = qTextInput.value.trim()
	const correctAnswer = qCorrectInput.value.trim()
	const options = type === 'MULTIPLE_CHOICE' ? collectOptions() : null

	if (!text) {
		showToast('Question text is required.', 'error')
		return
	}
	if (!correctAnswer) {
		showToast('Correct answer is required.', 'error')
		return
	}
	if (type === 'MULTIPLE_CHOICE') {
		if (!options.length) {
			showToast('Add at least one option.', 'error')
			return
		}
		if (!options.includes(correctAnswer)) {
			showToast('Correct answer must match one of the options.', 'error')
			return
		}
	}
	if (
		type === 'TRUE_FALSE' &&
		!['true', 'false'].includes(correctAnswer.toLowerCase())
	) {
		showToast('True/False answer must be "true" or "false".', 'error')
		return
	}
	if (!id && !currentEventId) {
		showToast('Save the event first before adding questions.', 'error')
		return
	}

	qSubmitBtn.disabled = true
	qSubmitBtn.textContent = 'Saving…'

	try {
		const url = id
			? `${API_BASE}/api/questions/${id}`
			: `${API_BASE}/api/events/${currentEventId}/questions`
		const method = id ? 'PUT' : 'POST'

		const res = await fetch(url, {
			method,
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type, text, correctAnswer, options }),
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(data.error || `Server error ${res.status}`)

		showToast(id ? 'Question updated.' : 'Question created.', 'success')
		resetQuestionForm()
		loadQuestions(currentEventId)
	} catch (err) {
		showToast(err.message, 'error')
	} finally {
		qSubmitBtn.disabled = false
		qSubmitBtn.textContent = 'Save Question'
	}
})

function openQuestionDeleteModal(q) {
	pendingQuestionDeleteId = q.id
	qModalBody.textContent = `"${q.text}" will be permanently removed from this event.`
	qModalOverlay.classList.remove('hidden')
}

function closeQuestionDeleteModal() {
	pendingQuestionDeleteId = null
	qModalOverlay.classList.add('hidden')
}

qModalCancel.addEventListener('click', closeQuestionDeleteModal)
qModalOverlay.addEventListener('click', (e) => {
	if (e.target === qModalOverlay) closeQuestionDeleteModal()
})

qModalConfirm.addEventListener('click', async () => {
	if (!pendingQuestionDeleteId) return
	const id = pendingQuestionDeleteId
	closeQuestionDeleteModal()

	try {
		const res = await fetch(`${API_BASE}/api/questions/${id}`, {
			method: 'DELETE',
			credentials: 'include',
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(data.error || `Server error ${res.status}`)

		const item = qList.querySelector(`[data-id="${id}"]`)
		if (item) item.remove()

		const remaining = qList.querySelectorAll('.q-item').length
		qCount.textContent = `${remaining} question${remaining !== 1 ? 's' : ''}`
		if (!remaining) qEmpty.classList.remove('hidden')

		showToast('Question deleted.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
})
