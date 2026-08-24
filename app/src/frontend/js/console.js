// console.js - UNIFIED CONSOLE MANAGEMENT
import { api_base, showToast, toDatetimeLocal, buildCardBody } from './utils.js'
import { API_BASE } from './constants.js'

const AUTHOR_ROLES = ['SUPER_ADMIN', 'EVENT_AUTHOR', 'CARD_AUTHOR']
const AUTH_API = `${API_BASE}/api/auth`
const CARDS_API = `${API_BASE}/api/cards`

// ── DOM REFS ──
// Auth
const elLoginView = document.getElementById('login-view')
const elLoginForm = document.getElementById('login-form')
const elLoginError = document.getElementById('login-error')
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

const f = (id) => document.getElementById(id)
const cf = (id) => document.getElementById(id)

// ── STATE ──
let pendingDeleteId = null
let pendingCardDeleteId = null
let allCards = []

// ── HELPERS ──
function hideAllConsoleUI() {
    elConsole.classList.add('hidden')
    elAccessDenied.classList.add('hidden')
    elUserBadge.style.display = 'none'
    btnLogout.style.display = 'none'
    btnLogoutDenied.style.display = 'none'
    elLoginView.classList.remove('hidden')

    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('tab-active'))
    tabEvents.classList.add('hidden')
    tabCards.classList.add('hidden')

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
    await fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' });
  } catch (err) {
    console.warn('Logout error:', err);
  }
  window.location.href = 'auth.html';
}

btnLogout.addEventListener('click', doLogout)
btnLogoutDenied.addEventListener('click', doLogout)

elLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    elLoginError.classList.add('hidden')

    const username = f('login-username').value.trim()
    const pin = f('login-pin').value

    if (!username || !pin) {
        elLoginError.textContent = 'Username and PIN are required.'
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
            body: JSON.stringify({ username, pin }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Login failed')

        elLoginView.classList.add('hidden')
        f('login-pin').value = ''
        await checkAccess()
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
            elLoginView.classList.add('hidden')
            return
        }

        elUserBadge.textContent = user.name
        elUserBadge.style.display = ''
        btnLogout.style.display = ''
        elConsole.classList.remove('hidden')
        elLoginView.classList.add('hidden')

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
        elLoginView.classList.remove('hidden')
        elConsole.classList.add('hidden')
        elAccessDenied.classList.add('hidden')
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
        if (!res.ok) {
            if (res.status === 401) {
                await checkAccess()
                return
            }
            throw new Error(`Server responded with ${res.status}`)
        }
        const data = await res.json()

        elLoading.classList.add('hidden')

        if (!data.length) {
            elEmpty.classList.remove('hidden')
            elEventCount.textContent = '0 events'
            return
        }

        elEventCount.textContent = `${data.length} event${data.length !== 1 ? 's' : ''}`
        data.forEach((ev) => elEventList.appendChild(buildEventCard(ev)))
    } catch (err) {
        elLoading.classList.add('hidden')
        elListError.textContent = `Could not load events — ${err.message}`
        elListError.classList.remove('hidden')
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
    li.querySelector('[data-action="delete"]').addEventListener('click', () =>
        openEventModal(ev.title, ev.event_id)
    )

    return li
}

btnNew.addEventListener('click', () => {
    resetEventForm()
    formHeading.textContent = 'New Event'
    btnSubmit.textContent = 'Save Event'
    btnSubmit.disabled = false
    showEventForm()
})

btnCancel.addEventListener('click', () => {
    resetEventForm()
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
        attempt_cooldown_s: parseInt(f('f-cooldown').value, 10) || 86400,
        max_attempts_per_window: parseInt(f('f-max-attempts').value, 10) || 1,
        repeat_interval: f('f-interval').value ? parseInt(f('f-interval').value, 10) : null,
        starts_at: f('f-starts').value || null,
        ends_at: f('f-ends').value || null,
        is_active: f('f-active').checked,
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
        if (!res.ok) {
            if (res.status === 401) {
                showToast('Session expired. Please login again.', 'error')
                setTimeout(() => {
                    window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname)
                }, 1000)
                return
            }
            throw new Error(data.error || `Server error ${res.status}`)
        }

        showToast(id ? 'Event updated successfully.' : 'Event created successfully.', 'success')
        resetEventForm()
        showEventList()
        loadEvents()
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
        const res = await fetch(`${api_base}/${id}`, {
            method: 'DELETE',
            credentials: 'include',
        })
        const data = await res.json()
        if (!res.ok) {
            if (res.status === 401) {
                showToast('Session expired. Please login again.', 'error')
                setTimeout(() => {
                    window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname)
                }, 1000)
                return
            }
            throw new Error(data.error || `Server error ${res.status}`)
        }

        const card = elEventList.querySelector(`[data-id="${id}"]`)
        if (card) card.remove()

        const remaining = elEventList.querySelectorAll('.event-card').length
        elEventCount.textContent = `${remaining} event${remaining !== 1 ? 's' : ''}`
        if (!remaining) elEmpty.classList.remove('hidden')

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

        elCardCount.textContent = `${data.length} card${data.length !== 1 ? 's' : ''}`
        data.forEach((card) => elCardList.appendChild(buildCardRow(card)))
    } catch (err) {
        elCardLoading.classList.add('hidden')
        elCardListError.textContent = `Could not load cards — ${err.message}`
        elCardListError.classList.remove('hidden')
    }
}

const RARITY_COLOURS = {
    COMMON: 'var(--text-muted)',
    RARE: '#60a5fa',
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
    li.querySelector('[data-action="delete"]').addEventListener('click', () =>
        openCardModal(card.name, card.card_id)
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
                showToast('Session expired. Please login again.', 'error')
                setTimeout(() => {
                    window.location.href = 'auth.html?redirect=' + encodeURIComponent(window.location.pathname)
                }, 1000)
                return
            }
            throw new Error(data.error || `Server error ${res.status}`)
        }

        showToast(id ? 'Card updated successfully.' : 'Card created successfully.', 'success')
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
        if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

        const row = elCardList.querySelector(`[data-id="${id}"]`)
        if (row) row.remove()

        const remaining = elCardList.querySelectorAll('.event-card').length
        elCardCount.textContent = `${remaining} card${remaining !== 1 ? 's' : ''}`
        if (!remaining) elCardEmpty.classList.remove('hidden')

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

// ── BOOT ──
checkAccess()