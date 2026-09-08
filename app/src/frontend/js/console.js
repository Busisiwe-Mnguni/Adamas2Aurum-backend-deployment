// console.js - UNIFIED CONSOLE MANAGEMENT
import {
	EVENTS_API,
	showToast,
	toDatetimeLocal,
	buildCardBody,
} from './utils.js'
import { API_BASE } from './constants.js'
import { updateAuthNav, isAdmin } from './auth-helpers.js'

const AUTH_API = `${API_BASE}/api/auth`
const CARDS_API = `${API_BASE}/api/cards`

// ── DOM REFS ──
// Auth
const elAccessDenied = document.getElementById('access-denied')
const elConsole = document.getElementById('console-content')
const elUserBadge = document.getElementById('user-badge')
const btnLogout = document.getElementById('btn-logout')
const btnLogoutDenied = document.getElementById('btn-logout-denied')

// Events
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

// Cards
const elCardList = document.getElementById('card-list')
const elCardCount = document.getElementById('card-count')
const elCardLoading = document.getElementById('card-loading')
const elCardEmpty = document.getElementById('card-empty')
const elCardListError = document.getElementById('card-list-error')
const cardViewList = document.getElementById('card-view-list')
const cardViewForm = document.getElementById('card-view-form')
const cardFormHeading = document.getElementById('card-form-heading')
const cardForm = document.getElementById('card-form')
const cardEditId = document.getElementById('card-edit-id')
const btnCardNew = document.getElementById('btn-card-new')
const btnCardCancel = document.getElementById('btn-card-cancel')
const btnCardSubmit = document.getElementById('btn-card-submit')

// Modal
const modalOverlay = document.getElementById('modal-overlay')
const modalBody = document.getElementById('modal-body')
const modalTitle = document.querySelector('.modal-title')
const modalCancel = document.getElementById('modal-cancel')
const modalConfirm = document.getElementById('modal-confirm')

// Tabs
const tabButtons = document.querySelectorAll('.tab-btn')
const tabEvents = document.getElementById('tab-events')
const tabCards = document.getElementById('tab-cards')

// Sub-tabs (event edit view)
const editLayout = document.getElementById('event-edit-layout')
const subTabBtns = document.querySelectorAll('.sub-tab-btn')
const subtabDetails = document.getElementById('subtab-details')
const subtabQuestions = document.getElementById('subtab-questions')
const subtabPool = document.getElementById('subtab-pool')

// Card pool
const poolList = document.getElementById('pool-list')
const poolCount = document.getElementById('pool-count')
const poolLoading = document.getElementById('pool-loading')
const poolEmpty = document.getElementById('pool-empty')
const poolForm = document.getElementById('pool-form')
const poolSelect = document.getElementById('pool-card-select')
const poolWeight = document.getElementById('pool-weight')
const poolCopyLimit = document.getElementById('pool-copy-limit')
const poolSubmit = document.getElementById('pool-submit')
const poolModalOverlay = document.getElementById('pool-modal-overlay')
const poolModalBody = document.getElementById('pool-modal-body')
const poolModalCancel = document.getElementById('pool-modal-cancel')
const poolModalConfirm = document.getElementById('pool-modal-confirm')

// Toolbars
const eventToolbar = document.getElementById('event-toolbar')
const eventFilterChips = document.getElementById('event-filter-chips')
const eventSortSelect = document.getElementById('event-sort')
const cardToolbar = document.getElementById('card-toolbar')
const cardFilterChips = document.getElementById('card-filter-chips')
const cardSortSelect = document.getElementById('card-sort')

const f = (id) => document.getElementById(id)
const cf = (id) => document.getElementById(id)

// ── STATE ──
let pendingDeleteId = null
let pendingCardDeleteId = null
let pendingPoolDeleteId = null
let allCards = []
let allEvents = []
let eventFilters = new Set(['active', 'scheduled', 'inactive', 'expired'])
let cardFilters = new Set(['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'])

// ── HELPERS ──
function hideAllConsoleUI() {
	elConsole.classList.add('hidden')
	elAccessDenied.classList.add('hidden')
	elUserBadge.classList.add('hidden')
	btnLogout.classList.add('hidden')
	btnLogoutDenied.classList.add('hidden')

	document.querySelectorAll('.tab-btn').forEach((t) =>
		t.classList.remove('tab-active')
	)
	tabEvents.classList.add('hidden')
	tabCards.classList.add('hidden')

	if (editLayout) editLayout.classList.add('hidden')

	resetEventForm()
	resetCardForm()
	showEventList()
	showCardList()
}

function showEventList() {
	viewList.classList.remove('hidden')
	viewForm.classList.add('hidden')
}

function showEventForm() {
	viewList.classList.add('hidden')
	viewForm.classList.remove('hidden')
}

function showCardList() {
	cardViewList.classList.remove('hidden')
	cardViewForm.classList.add('hidden')
}

function showCardForm() {
	cardViewList.classList.add('hidden')
	cardViewForm.classList.remove('hidden')
}

function resetEventForm() {
	eventForm.reset()
	editIdInput.value = ''
	f('f-active').checked = true
	btnSubmit.disabled = false
	btnSubmit.textContent = 'Save Event'
}

function resetCardForm() {
	cardForm.reset()
	cardEditId.value = ''
	btnCardSubmit.disabled = false
	btnCardSubmit.textContent = 'Save Card'
}

// ── AUTH ──
async function doLogout() {
	try {
		await fetch(`${AUTH_API}/logout`, {
			method: 'POST',
			credentials: 'include',
		})
	} catch (err) {
		console.warn('Logout error:', err)
	}
	window.location.href = '../index.html'
}

btnLogout.addEventListener('click', doLogout)
btnLogoutDenied.addEventListener('click', doLogout)

async function checkAccess() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error('Not authenticated')
		const user = await res.json()

		updateAuthNav(user)

		if (!isAdmin(user)) {
			elAccessDenied.classList.remove('hidden')
			return
		}

		elConsole.classList.remove('hidden')

		// Activate events tab by default
		const eventsTab = document.querySelector('[data-tab="events"]')
		if (eventsTab) {
			eventsTab.classList.add('tab-active')
		}
		tabEvents.classList.remove('hidden')
		tabCards.classList.add('hidden')

		loadEvents()
	} catch (err) {
		console.warn('Auth check failed:', err)
		window.location.href = '../index.html'
	}
}

// ── TABS ──
tabButtons.forEach((btn) => {
	btn.addEventListener('click', () => {
		tabButtons.forEach((b) => b.classList.remove('tab-active'))
		btn.classList.add('tab-active')

		if (btn.dataset.tab === 'cards') {
			tabEvents.classList.add('hidden')
			tabCards.classList.remove('hidden')
			if (!elConsole.classList.contains('hidden')) {
				loadCards()
			}
		} else {
			tabCards.classList.add('hidden')
			tabEvents.classList.remove('hidden')
			if (!elConsole.classList.contains('hidden')) {
				loadEvents()
			}
		}
	})
})

// ── EVENTS CRUD ──
const EVENT_SECTION_ORDER = ['active', 'scheduled', 'inactive', 'expired']
const EVENT_SECTION_LABELS = {
	active: 'Active',
	scheduled: 'Scheduled',
	inactive: 'Inactive',
	expired: 'Expired',
}

function classifyEvent(ev) {
	const now = new Date()
	if (!ev.is_active) return 'inactive'
	if (ev.starts_at && new Date(ev.starts_at) > now) return 'scheduled'
	if (ev.ends_at && new Date(ev.ends_at) < now) return 'expired'
	return 'active'
}

async function loadEvents() {
	elLoading.classList.remove('hidden')
	elEmpty.classList.add('hidden')
	elListError.classList.add('hidden')
	elEventList.innerHTML = ''
	elEventCount.textContent = 'Loading…'
	eventToolbar.classList.add('hidden')

	try {
		const res = await fetch(`${EVENTS_API}?all=true`, {
			credentials: 'include',
		})
		if (!res.ok) {
			if (res.status === 401) {
				await checkAccess()
				return
			}
			throw new Error(`Server responded with ${res.status}`)
		}
		const data = await res.json()
		allEvents = data

		elLoading.classList.add('hidden')

		if (!data.length) {
			elEmpty.classList.remove('hidden')
			elEventCount.textContent = '0 events'
			return
		}

		eventToolbar.classList.remove('hidden')
		renderEvents()
	} catch (err) {
		elLoading.classList.add('hidden')
		elListError.textContent = `Could not load events — ${err.message}`
		elListError.classList.remove('hidden')
	}
}

function renderEvents() {
	elEventList.innerHTML = ''
	elEmpty.classList.add('hidden')

	const sortBy = eventSortSelect.value
	const sorted = [...allEvents].sort((a, b) => {
		switch (sortBy) {
			case 'oldest':
				return (
					new Date(a.created_at) -
					new Date(b.created_at)
				)
			case 'title':
				return a.title.localeCompare(b.title)
			case 'points':
				return (
					(b.point_reward ?? 0) -
					(a.point_reward ?? 0)
				)
			default:
				return (
					new Date(b.created_at) -
					new Date(a.created_at)
				)
		}
	})

	const groups = { active: [], scheduled: [], inactive: [], expired: [] }
	sorted.forEach((ev) => {
		groups[classifyEvent(ev)].push(ev)
	})

	let visibleCount = 0
	EVENT_SECTION_ORDER.forEach((key) => {
		const items = groups[key]
		if (items.length === 0) return
		if (!eventFilters.has(key)) return

		visibleCount += items.length

		const details = document.createElement('details')
		details.className = 'list-section'
		details.open = true
		details.dataset.section = key

		const summary = document.createElement('summary')
		summary.innerHTML = `${EVENT_SECTION_LABELS[key]} <span class="section-count">${items.length}</span>`
		details.appendChild(summary)

		const ul = document.createElement('ul')
		ul.className = 'event-list'
		items.forEach((ev) => ul.appendChild(buildEventCard(ev)))
		details.appendChild(ul)

		elEventList.appendChild(details)
	})

	const total = allEvents.length
	if (visibleCount === total) {
		elEventCount.textContent = `${total} event${total !== 1 ? 's' : ''}`
	} else {
		elEventCount.textContent = `Showing ${visibleCount} of ${total} events`
	}

	if (visibleCount === 0 && total > 0) {
		elEmpty.textContent = 'No events match the current filters.'
		elEmpty.classList.remove('hidden')
	}
}

function buildEventCard(ev) {
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
		openEventEditForm(ev)
	)
	li.querySelector('[data-action="delete"]').addEventListener(
		'click',
		() => openEventModal(ev.title, ev.event_id)
	)

	return li
}

btnNew.addEventListener('click', () => {
	resetEventForm()
	formHeading.textContent = 'New Event'
	btnSubmit.textContent = 'Save Event'
	btnSubmit.disabled = false
	editLayout.classList.remove('hidden')
	document.getElementById('event-sub-tabs').style.display = ''
	resetSubTabs('details')
	setSubTabsEnabled(false)
	showEventForm()
})

btnCancel.addEventListener('click', () => {
	resetEventForm()
	editLayout.classList.add('hidden')
	showEventList()
	loadEvents()
})

function openEventEditForm(ev) {
	resetEventForm()
	formHeading.textContent = 'Edit Event'
	btnSubmit.textContent = 'Save Changes'
	btnSubmit.disabled = false

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

	showEventForm()
	editLayout.classList.remove('hidden')
	document.getElementById('event-sub-tabs').style.display = ''
	resetSubTabs('details')
	setSubTabsEnabled(true)
}

function resetSubTabs(active) {
	subTabBtns.forEach((b) => b.classList.remove('sub-tab-active'))
	const btn = document.querySelector(`[data-subtab="${active}"]`)
	if (btn) btn.classList.add('sub-tab-active')
	subtabDetails.classList.toggle('hidden', active !== 'details')
	subtabQuestions.classList.toggle('hidden', active !== 'questions')
	subtabPool.classList.toggle('hidden', active !== 'pool')
}

function setSubTabsEnabled(enabled) {
	subTabBtns.forEach((b) => {
		if (b.dataset.subtab !== 'details') b.disabled = !enabled
	})
}

eventForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const id = editIdInput.value

	const title = f('f-title').value.trim()
	if (!title) {
		showToast('Title is required.', 'error')
		return
	}

	const lat = parseFloat(f('f-latitude').value)
	const lng = parseFloat(f('f-longitude').value)
	if (isNaN(lat) || isNaN(lng)) {
		showToast('Valid latitude and longitude are required.', 'error')
		return
	}

	const radius = parseInt(f('f-radius').value, 10)
	if (!radius || radius < 10) {
		showToast('Radius must be at least 10 metres.', 'error')
		return
	}

	const payload = {
		title: title,
		description: f('f-description').value.trim() || null,
		latitude: lat,
		longitude: lng,
		radius_meters: radius,
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

	btnSubmit.disabled = true
	btnSubmit.textContent = 'Saving…'

	try {
		const url = id ? `${EVENTS_API}/${id}` : EVENTS_API
		const method = id ? 'PUT' : 'POST'

		const res = await fetch(url, {
			method,
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const data = await res.json()
		if (!res.ok) {
			if (res.status === 401) {
				showToast(
					'Session expired. Please login again.',
					'error'
				)
				setTimeout(() => {
					window.location.href = '../index.html'
				}, 1000)
				return
			}
			throw new Error(
				data.error || `Server error ${res.status}`
			)
		}

		if (id) {
			// Editing existing event — go back to list as before
			showToast('Event updated successfully.', 'success')
			resetEventForm()
			showEventList()
			loadEvents()
		} else {
			// New event just created — stay on the form and open the
			// questions panel so the author can add questions immediately
			const newEventId = data.event_id
			editIdInput.value = newEventId
			formHeading.textContent = 'Edit Event'
			btnSubmit.textContent = 'Save Changes'
			btnSubmit.disabled = false

			currentEventId = newEventId
			editLayout.classList.remove('hidden')
			document.getElementById(
				'event-sub-tabs'
			).style.display = ''
			resetSubTabs('details')
			setSubTabsEnabled(true)
			resetQuestionForm()
			loadQuestions(newEventId)
			loadPool(newEventId)
			populatePoolCardSelect()

			showToast(
				'Event created! Add questions or cards via the side tabs.',
				'success'
			)
		}
	} catch (err) {
		showToast(err.message, 'error')
		btnSubmit.disabled = false
		btnSubmit.textContent = id ? 'Save Changes' : 'Save Event'
	}
})

function openEventModal(title, id) {
	pendingDeleteId = id
	modalTitle.textContent = 'Delete this event?'
	modalBody.textContent = `"${title}" will be permanently removed from the map.`
	modalOverlay.classList.remove('hidden')
	modalConfirm.onclick = doEventDelete
}

async function doEventDelete() {
	if (!pendingDeleteId) return
	const id = pendingDeleteId
	closeModal()

	try {
		const res = await fetch(`${EVENTS_API}/${id}`, {
			method: 'DELETE',
			credentials: 'include',
		})
		const data = await res.json()
		if (!res.ok) {
			if (res.status === 401) {
				showToast(
					'Session expired. Please login again.',
					'error'
				)
				setTimeout(() => {
					window.location.href = '../index.html'
				}, 1000)
				return
			}
			throw new Error(
				data.error || `Server error ${res.status}`
			)
		}

		const card = elEventList.querySelector(`[data-id="${id}"]`)
		if (card) {
			const section = card.closest('.list-section')
			card.remove()

			if (section) {
				const remaining =
					section.querySelectorAll(
						'.event-card'
					).length
				const badge =
					section.querySelector('.section-count')
				if (badge) badge.textContent = remaining
				if (remaining === 0) section.remove()
			}
		}

		allEvents = allEvents.filter((e) => e.event_id !== id)
		const remaining = allEvents.length
		if (remaining === 0) {
			elEmpty.textContent =
				'No events yet — create the first one.'
			elEmpty.classList.remove('hidden')
			eventToolbar.classList.add('hidden')
		}
		elEventCount.textContent = `${remaining} event${remaining !== 1 ? 's' : ''}`

		showToast('Event deleted.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
}

// ── CARDS CRUD ──
async function loadCards() {
	elCardLoading.classList.remove('hidden')
	elCardEmpty.classList.add('hidden')
	elCardListError.classList.add('hidden')
	elCardList.innerHTML = ''
	elCardCount.textContent = 'Loading…'
	cardToolbar.classList.add('hidden')

	try {
		const res = await fetch(CARDS_API, { credentials: 'include' })
		if (!res.ok) {
			if (res.status === 401) {
				elCardLoading.classList.add('hidden')
				return
			}
			throw new Error(`Server responded with ${res.status}`)
		}
		const data = await res.json()
		allCards = data

		elCardLoading.classList.add('hidden')

		if (!data.length) {
			elCardEmpty.classList.remove('hidden')
			elCardCount.textContent = '0 cards'
			return
		}

		cardToolbar.classList.remove('hidden')
		renderCards()
	} catch (err) {
		elCardLoading.classList.add('hidden')
		elCardListError.textContent = `Could not load cards — ${err.message}`
		elCardListError.classList.remove('hidden')
	}
}

const CARD_SECTION_ORDER = ['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON']
const RARITY_SORT_INDEX = {
	LEGENDARY: 0,
	EPIC: 1,
	RARE: 2,
	UNCOMMON: 3,
	COMMON: 4,
}

function renderCards() {
	elCardList.innerHTML = ''
	elCardEmpty.classList.add('hidden')

	const sortBy = cardSortSelect.value
	const sorted = [...allCards].sort((a, b) => {
		switch (sortBy) {
			case 'rarity': {
				const rd =
					(RARITY_SORT_INDEX[a.rarity] ?? 9) -
					(RARITY_SORT_INDEX[b.rarity] ?? 9)
				return rd !== 0
					? rd
					: a.name.localeCompare(b.name)
			}
			case 'category':
				return (
					a.category.localeCompare(b.category) ||
					a.name.localeCompare(b.name)
				)
			default:
				return a.name.localeCompare(b.name)
		}
	})

	const groups = {}
	CARD_SECTION_ORDER.forEach((r) => {
		groups[r] = []
	})
	sorted.forEach((card) => {
		if (groups[card.rarity]) groups[card.rarity].push(card)
		else groups[card.rarity] = [card]
	})

	let visibleCount = 0
	CARD_SECTION_ORDER.forEach((key) => {
		const items = groups[key]
		if (!items || items.length === 0) return
		if (!cardFilters.has(key)) return

		visibleCount += items.length

		const details = document.createElement('details')
		details.className = 'list-section'
		details.open = true
		details.dataset.section = key

		const summary = document.createElement('summary')
		const colour = RARITY_COLOURS[key] ?? 'inherit'
		summary.innerHTML = `<span style="color:${colour}">${key.charAt(0) + key.slice(1).toLowerCase()}</span> <span class="section-count">${items.length}</span>`
		details.appendChild(summary)

		const ul = document.createElement('ul')
		ul.className = 'event-list'
		items.forEach((card) => ul.appendChild(buildCardRow(card)))
		details.appendChild(ul)

		elCardList.appendChild(details)
	})

	const total = allCards.length
	if (visibleCount === total) {
		elCardCount.textContent = `${total} card${total !== 1 ? 's' : ''}`
	} else {
		elCardCount.textContent = `Showing ${visibleCount} of ${total} cards`
	}

	if (visibleCount === 0 && total > 0) {
		elCardEmpty.textContent = 'No cards match the current filters.'
		elCardEmpty.classList.remove('hidden')
	}
}

const RARITY_COLOURS = {
	COMMON: 'var(--text-muted)',
	UNCOMMON: '#27ae60',
	RARE: '#60a5fa',
	EPIC: '#a855f7',
	LEGENDARY: '#f59e0b',
}

function buildCardRow(card) {
	const li = document.createElement('li')
	li.className = 'event-card'
	li.dataset.id = card.card_id

	const rarityColour = RARITY_COLOURS[card.rarity] ?? 'inherit'

	li.innerHTML = `
        <div class="event-card-body">
            <div class="event-card-title">${card.name}</div>
            <div class="event-card-meta">
                <span style="color:${rarityColour};font-weight:600;">${card.rarity}</span>
                &nbsp;·&nbsp;
                <span>${card.category}</span>
                &nbsp;·&nbsp;
                <span>ATK ${card.stat_attack} &nbsp;LOC ${card.stat_location} &nbsp;INF ${card.stat_influence} &nbsp;LEG ${card.stat_legacy} &nbsp;ERA ${card.stat_era}</span>
            </div>
            ${card.flavour_text ? `<div class="event-card-desc" style="margin-top:0.25rem;font-style:italic;color:var(--text-muted);">"${card.flavour_text}"</div>` : ''}
        </div>
        <div class="event-card-actions">
            <button class="btn btn-ghost btn-sm" data-action="edit">Edit</button>
            <button class="btn btn-sm" data-action="delete"
                style="color:var(--danger);border-color:#5a2a2a;background:var(--danger-dim);">
                Delete
            </button>
        </div>
    `

	li.querySelector('[data-action="edit"]').addEventListener('click', () =>
		openCardEditForm(card)
	)
	li.querySelector('[data-action="delete"]').addEventListener(
		'click',
		() => openCardModal(card.name, card.card_id)
	)

	return li
}

btnCardNew.addEventListener('click', () => {
	resetCardForm()
	cardFormHeading.textContent = 'New Card'
	btnCardSubmit.textContent = 'Save Card'
	btnCardSubmit.disabled = false
	showCardForm()
})

btnCardCancel.addEventListener('click', () => {
	resetCardForm()
	showCardList()
	loadCards()
})

function openCardEditForm(card) {
	resetCardForm()
	cardFormHeading.textContent = 'Edit Card'
	btnCardSubmit.textContent = 'Save Changes'
	btnCardSubmit.disabled = false

	cardEditId.value = card.card_id
	cf('cf-name').value = card.name ?? ''
	cf('cf-flavour').value = card.flavour_text ?? ''
	cf('cf-image').value = card.image_url ?? ''
	cf('cf-category').value = card.category ?? ''
	cf('cf-rarity').value = card.rarity ?? ''
	cf('cf-attack').value = card.stat_attack ?? 0
	cf('cf-location').value = card.stat_location ?? 0
	cf('cf-influence').value = card.stat_influence ?? 0
	cf('cf-legacy').value = card.stat_legacy ?? 100
	cf('cf-era').value = card.stat_era ?? 0
	cf('cf-ability-name').value = card.ability_name ?? ''
	cf('cf-ability-desc').value = card.ability_desc ?? ''

	showCardForm()
}

cardForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const id = cardEditId.value

	const name = cf('cf-name').value.trim()
	if (!name) {
		showToast('Name is required.', 'error')
		return
	}
	const category = cf('cf-category').value
	if (!category) {
		showToast('Category is required.', 'error')
		return
	}
	const rarity = cf('cf-rarity').value
	if (!rarity) {
		showToast('Rarity is required.', 'error')
		return
	}

	const payload = {
		name: name,
		flavour_text: cf('cf-flavour').value.trim() || null,
		image_url: cf('cf-image').value.trim() || null,
		category: category,
		rarity: rarity,
		stat_attack: parseInt(cf('cf-attack').value, 10) || 0,
		stat_location: parseInt(cf('cf-location').value, 10) || 0,
		stat_influence: parseInt(cf('cf-influence').value, 10) || 0,
		stat_legacy: parseInt(cf('cf-legacy').value, 10) || 100,
		stat_era: parseInt(cf('cf-era').value, 10) || 0,
		ability_name: cf('cf-ability-name').value.trim() || null,
		ability_desc: cf('cf-ability-desc').value.trim() || null,
	}

	btnCardSubmit.disabled = true
	btnCardSubmit.textContent = 'Saving…'

	try {
		const url = id ? `${CARDS_API}/${id}` : CARDS_API
		const method = id ? 'PUT' : 'POST'

		const res = await fetch(url, {
			method,
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const data = await res.json()
		if (!res.ok) {
			if (res.status === 401) {
				showToast(
					'Session expired. Please login again.',
					'error'
				)
				setTimeout(() => {
					window.location.href = '../index.html'
				}, 1000)
				return
			}
			throw new Error(
				data.error || `Server error ${res.status}`
			)
		}

		showToast(
			id
				? 'Card updated successfully.'
				: 'Card created successfully.',
			'success'
		)
		resetCardForm()
		showCardList()
		loadCards()
	} catch (err) {
		showToast(err.message, 'error')
		btnCardSubmit.disabled = false
		btnCardSubmit.textContent = id ? 'Save Changes' : 'Save Card'
	}
})

function openCardModal(name, id) {
	pendingCardDeleteId = id
	modalTitle.textContent = 'Delete this card?'
	modalBody.textContent = `"${name}" will be permanently removed. This will fail if the card is still linked to an event pool or player collection.`
	modalOverlay.classList.remove('hidden')
	modalConfirm.onclick = doCardDelete
}

async function doCardDelete() {
	if (!pendingCardDeleteId) return
	const id = pendingCardDeleteId
	closeModal()

	try {
		const res = await fetch(`${CARDS_API}/${id}`, {
			method: 'DELETE',
			credentials: 'include',
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		const row = elCardList.querySelector(`[data-id="${id}"]`)
		if (row) {
			const section = row.closest('.list-section')
			row.remove()

			if (section) {
				const remaining =
					section.querySelectorAll(
						'.event-card'
					).length
				const badge =
					section.querySelector('.section-count')
				if (badge) badge.textContent = remaining
				if (remaining === 0) section.remove()
			}
		}

		allCards = allCards.filter((c) => c.card_id !== id)
		const remaining = allCards.length
		if (remaining === 0) {
			elCardEmpty.textContent =
				'No cards yet — create the first one.'
			elCardEmpty.classList.remove('hidden')
			cardToolbar.classList.add('hidden')
		}
		elCardCount.textContent = `${remaining} card${remaining !== 1 ? 's' : ''}`

		showToast('Card deleted.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
}

// ── MODAL ──
function closeModal() {
	pendingDeleteId = null
	pendingCardDeleteId = null
	modalConfirm.onclick = null
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
		const res = await fetch(`${EVENTS_API}/${id}`, {
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
	loadQuestions(id)
	loadPool(id)
	populatePoolCardSelect()
})

// Brand-new events have no id yet.
btnNew.addEventListener('click', () => {
	currentEventId = null
	resetQuestionForm()
})

// Leaving the edit view resets the question form.
btnCancel.addEventListener('click', () => {
	currentEventId = null
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

	const typeLabel = String(q.type).replace(/_/g, ' ').toLowerCase()
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
			showToast(
				'Correct answer must match one of the options.',
				'error'
			)
			return
		}
	}
	if (
		type === 'TRUE_FALSE' &&
		!['true', 'false'].includes(correctAnswer.toLowerCase())
	) {
		showToast(
			'True/False answer must be "true" or "false".',
			'error'
		)
		return
	}
	if (!id && !currentEventId) {
		showToast(
			'Save the event first before adding questions.',
			'error'
		)
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
			body: JSON.stringify({
				type,
				text,
				correctAnswer,
				options,
			}),
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		showToast(
			id ? 'Question updated.' : 'Question created.',
			'success'
		)
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
			throw new Error(
				data.error || `Server error ${res.status}`
			)

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

// ============================================================
// Sub-tab switching
// ============================================================
subTabBtns.forEach((btn) => {
	btn.addEventListener('click', () => {
		resetSubTabs(btn.dataset.subtab)
	})
})

// ============================================================
// Filter chips + sort controls
// ============================================================
function wireFilterChips(container, filterSet, allKeys, renderFn) {
	container.addEventListener('click', (e) => {
		const chip = e.target.closest('.filter-chip')
		if (!chip) return
		const key = chip.dataset.filter

		if (key === 'all') {
			const allActive = allKeys.every((k) => filterSet.has(k))
			if (allActive) {
				allKeys.forEach((k) => filterSet.delete(k))
			} else {
				allKeys.forEach((k) => filterSet.add(k))
			}
		} else {
			if (filterSet.has(key)) {
				filterSet.delete(key)
			} else {
				filterSet.add(key)
			}
		}

		container.querySelectorAll('.filter-chip').forEach((c) => {
			const k = c.dataset.filter
			if (k === 'all') {
				c.classList.toggle(
					'active',
					allKeys.every((k2) => filterSet.has(k2))
				)
			} else {
				c.classList.toggle('active', filterSet.has(k))
			}
		})

		renderFn()
	})
}

wireFilterChips(
	eventFilterChips,
	eventFilters,
	['active', 'scheduled', 'inactive', 'expired'],
	renderEvents
)
wireFilterChips(
	cardFilterChips,
	cardFilters,
	['LEGENDARY', 'EPIC', 'RARE', 'UNCOMMON', 'COMMON'],
	renderCards
)

eventSortSelect.addEventListener('change', renderEvents)
cardSortSelect.addEventListener('change', renderCards)

// ============================================================
// Card Pool Management
// ============================================================
const POOL_API = (eventId) => `${EVENTS_API}/${eventId}/pool`

async function loadPool(eventId) {
	poolLoading.classList.remove('hidden')
	poolEmpty.classList.add('hidden')
	poolList.innerHTML = ''
	poolCount.textContent = 'Loading…'

	try {
		const res = await fetch(POOL_API(eventId), {
			credentials: 'include',
		})
		if (!res.ok)
			throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

		poolLoading.classList.add('hidden')
		poolCount.textContent = `${data.length} card${data.length !== 1 ? 's' : ''} in pool`

		if (!data.length) {
			poolEmpty.classList.remove('hidden')
			return
		}
		data.forEach((item) =>
			poolList.appendChild(buildPoolItem(item))
		)
	} catch (err) {
		poolLoading.classList.add('hidden')
		poolCount.textContent = 'Could not load pool'
		showToast(err.message, 'error')
	}
}

function buildPoolItem(item) {
	const li = document.createElement('li')
	li.className = 'pool-item'
	li.dataset.poolId = item.pool_id

	const rarityColour = RARITY_COLOURS[item.rarity] ?? 'inherit'

	const limitLabel =
		item.global_copy_limit != null
			? `${item.copies_awarded} / ${item.global_copy_limit} awarded`
			: `${item.copies_awarded} awarded (unlimited)`

	li.innerHTML = `
		<div>
			<div class="pool-item-name">${escapeHtml(item.name)}</div>
			<div class="pool-item-meta">
				<span style="color:${rarityColour};font-weight:600;">${escapeHtml(item.rarity)}</span>
				<span>&middot; ${escapeHtml(item.category)}</span>
				<span>&middot; Wt:</span>
				<input type="number" min="1" value="${item.weight}"
					class="pool-inline-field" data-field="weight" data-pool-id="${item.pool_id}" />
				<span>&middot; Limit:</span>
				<input type="number" min="1" value="${item.global_copy_limit ?? ''}"
					placeholder="∞"
					class="pool-inline-field" data-field="limit" data-pool-id="${item.pool_id}" />
				<span>&middot; ${escapeHtml(limitLabel)}</span>
			</div>
		</div>
		<div class="pool-item-actions">
			<button class="btn btn-ghost btn-sm" data-pool-action="save">Save</button>
			<button class="btn btn-sm" data-pool-action="remove"
				style="color:var(--danger);border-color:#5a2a2a;background:var(--danger-dim);">
				Remove
			</button>
		</div>
	`

	li.querySelector('[data-pool-action="save"]').addEventListener(
		'click',
		() => savePoolEntry(item.pool_id, li)
	)
	li.querySelector('[data-pool-action="remove"]').addEventListener(
		'click',
		() => openPoolDeleteModal(item.name, item.pool_id)
	)

	return li
}

async function savePoolEntry(poolId, li) {
	const weightInput = li.querySelector('[data-field="weight"]')
	const limitInput = li.querySelector('[data-field="limit"]')

	const weight = parseInt(weightInput.value, 10) || 1
	const limitVal = limitInput.value.trim()
	const global_copy_limit = limitVal ? parseInt(limitVal, 10) : null

	try {
		const res = await fetch(
			`${POOL_API(currentEventId)}/${poolId}`,
			{
				method: 'PUT',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					weight,
					global_copy_limit,
				}),
			}
		)
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)
		showToast('Pool entry updated.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
}

async function populatePoolCardSelect() {
	if (!allCards.length) {
		try {
			const res = await fetch(CARDS_API, {
				credentials: 'include',
			})
			if (res.ok) allCards = await res.json()
		} catch {
			/* ignore */
		}
	}

	poolSelect.innerHTML = '<option value="">-- pick a card --</option>'
	const sorted = [...allCards].sort((a, b) => {
		const rarityOrder = {
			COMMON: 0,
			UNCOMMON: 1,
			RARE: 2,
			EPIC: 3,
			LEGENDARY: 4,
		}
		const rd =
			(rarityOrder[a.rarity] ?? 0) -
			(rarityOrder[b.rarity] ?? 0)
		if (rd !== 0) return rd
		return a.name.localeCompare(b.name)
	})
	sorted.forEach((card) => {
		const opt = document.createElement('option')
		opt.value = card.card_id
		opt.textContent = `${card.name} (${card.rarity})`
		poolSelect.appendChild(opt)
	})
}

poolForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const cardId = poolSelect.value
	if (!cardId) {
		showToast('Please select a card.', 'error')
		return
	}
	if (!currentEventId) {
		showToast('Save the event first.', 'error')
		return
	}

	const weight = parseInt(poolWeight.value, 10) || 1
	const limitVal = poolCopyLimit.value.trim()
	const global_copy_limit = limitVal ? parseInt(limitVal, 10) : null

	poolSubmit.disabled = true
	poolSubmit.textContent = 'Adding…'

	try {
		const res = await fetch(POOL_API(currentEventId), {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				card_id: parseInt(cardId, 10),
				weight,
				global_copy_limit,
			}),
		})
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		showToast('Card added to pool.', 'success')
		poolForm.reset()
		loadPool(currentEventId)
	} catch (err) {
		showToast(err.message, 'error')
	} finally {
		poolSubmit.disabled = false
		poolSubmit.textContent = 'Add to Pool'
	}
})

function openPoolDeleteModal(name, poolId) {
	pendingPoolDeleteId = poolId
	poolModalBody.textContent = `"${name}" will be removed from this event's card pool.`
	poolModalOverlay.classList.remove('hidden')
}

function closePoolDeleteModal() {
	pendingPoolDeleteId = null
	poolModalOverlay.classList.add('hidden')
}

poolModalCancel.addEventListener('click', closePoolDeleteModal)
poolModalOverlay.addEventListener('click', (e) => {
	if (e.target === poolModalOverlay) closePoolDeleteModal()
})

poolModalConfirm.addEventListener('click', async () => {
	if (!pendingPoolDeleteId) return
	const poolId = pendingPoolDeleteId
	closePoolDeleteModal()

	try {
		const res = await fetch(
			`${POOL_API(currentEventId)}/${poolId}`,
			{
				method: 'DELETE',
				credentials: 'include',
			}
		)
		const data = await res.json()
		if (!res.ok)
			throw new Error(
				data.error || `Server error ${res.status}`
			)

		const item = poolList.querySelector(
			`[data-pool-id="${poolId}"]`
		)
		if (item) item.remove()

		const remaining = poolList.querySelectorAll('.pool-item').length
		poolCount.textContent = `${remaining} card${remaining !== 1 ? 's' : ''} in pool`
		if (!remaining) poolEmpty.classList.remove('hidden')

		showToast('Card removed from pool.', 'success')
	} catch (err) {
		showToast(err.message, 'error')
	}
})
