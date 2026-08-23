import { API_BASE } from './constants.js'
import { showToast } from './utils.js'

const CARDS_API = `${API_BASE}/api/cards`

//  DOM refs 
const elCardList      = document.getElementById('card-list')
const elCardCount     = document.getElementById('card-count')
const elCardLoading   = document.getElementById('card-loading')
const elCardEmpty     = document.getElementById('card-empty')
const elCardListError = document.getElementById('card-list-error')

const cardViewList = document.getElementById('card-view-list')
const cardViewForm = document.getElementById('card-view-form')
const cardFormHeading = document.getElementById('card-form-heading')
const cardForm        = document.getElementById('card-form')
const cardEditId      = document.getElementById('card-edit-id')
const btnCardNew      = document.getElementById('btn-card-new')
const btnCardCancel   = document.getElementById('btn-card-cancel')
const btnCardSubmit   = document.getElementById('btn-card-submit')

// Shorthand: get a form field by id
const cf = (id) => document.getElementById(id)

// ── Tab switching (wired up here so cards.js is self-contained) ──
const tabButtons = document.querySelectorAll('.tab-btn')
const tabEvents  = document.getElementById('tab-events')
const tabCards   = document.getElementById('tab-cards')

tabButtons.forEach((btn) => {
	btn.addEventListener('click', () => {
		tabButtons.forEach((b) => b.classList.remove('tab-active'))
		btn.classList.add('tab-active')

		if (btn.dataset.tab === 'cards') {
			tabEvents.classList.add('hidden')
			tabCards.classList.remove('hidden')
			loadCards()
		} else {
			tabCards.classList.add('hidden')
			tabEvents.classList.remove('hidden')
		}
	})
})

//  List view helpers 

function showCardList() {
	cardViewList.classList.remove('hidden')
	cardViewForm.classList.add('hidden')
}

function showCardForm() {
	cardViewList.classList.add('hidden')
	cardViewForm.classList.remove('hidden')
}

//  Load & render cards 

async function loadCards() {
	elCardLoading.classList.remove('hidden')
	elCardEmpty.classList.add('hidden')
	elCardListError.classList.add('hidden')
	elCardList.innerHTML = ''
	elCardCount.textContent = 'Loading…'

	try {
		const res = await fetch(CARDS_API, { credentials: 'include' })
		if (!res.ok) throw new Error(`Server responded with ${res.status}`)
		const data = await res.json()

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
	COMMON:    'var(--text-muted)',
	RARE:      '#60a5fa',
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

//  New / Edit form 

btnCardNew.addEventListener('click', () => {
	resetCardForm()
	cardFormHeading.textContent = 'New Card'
	btnCardSubmit.textContent   = 'Save Card'
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
	btnCardSubmit.textContent   = 'Save Changes'

	cardEditId.value             = card.card_id
	cf('cf-name').value          = card.name          ?? ''
	cf('cf-flavour').value       = card.flavour_text  ?? ''
	cf('cf-image').value         = card.image_url     ?? ''
	cf('cf-category').value      = card.category      ?? ''
	cf('cf-rarity').value        = card.rarity        ?? ''
	cf('cf-attack').value        = card.stat_attack   ?? 0
	cf('cf-location').value      = card.stat_location ?? 0
	cf('cf-influence').value     = card.stat_influence ?? 0
	cf('cf-legacy').value        = card.stat_legacy   ?? 100
	cf('cf-era').value           = card.stat_era      ?? 0
	cf('cf-ability-name').value  = card.ability_name  ?? ''
	cf('cf-ability-desc').value  = card.ability_desc  ?? ''

	showCardForm()
}

function resetCardForm() {
	cardForm.reset()
	cardEditId.value = ''
}

//  Form submit (create / update) 

cardForm.addEventListener('submit', async (e) => {
	e.preventDefault()

	const id = cardEditId.value

	const payload = {
		name:          cf('cf-name').value.trim(),
		flavour_text:  cf('cf-flavour').value.trim()      || null,
		image_url:     cf('cf-image').value.trim()        || null,
		category:      cf('cf-category').value,
		rarity:        cf('cf-rarity').value,
		stat_attack:   parseInt(cf('cf-attack').value,    10) || 0,
		stat_location: parseInt(cf('cf-location').value,  10) || 0,
		stat_influence:parseInt(cf('cf-influence').value, 10) || 0,
		stat_legacy:   parseInt(cf('cf-legacy').value,    10) ?? 100,
		stat_era:      parseInt(cf('cf-era').value,       10) || 0,
		ability_name:  cf('cf-ability-name').value.trim() || null,
		ability_desc:  cf('cf-ability-desc').value.trim() || null,
	}

	if (!payload.name) {
		showToast('Name is required.', 'error')
		return
	}
	if (!payload.category) {
		showToast('Category is required.', 'error')
		return
	}
	if (!payload.rarity) {
		showToast('Rarity is required.', 'error')
		return
	}

	btnCardSubmit.disabled    = true
	btnCardSubmit.textContent = 'Saving…'

	try {
		const url    = id ? `${CARDS_API}/${id}` : CARDS_API
		const method = id ? 'PUT' : 'POST'

		const res = await fetch(url, {
			method,
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		const data = await res.json()
		if (!res.ok) throw new Error(data.error || `Server error ${res.status}`)

		showToast(id ? 'Card updated.' : 'Card created.', 'success')
		resetCardForm()
		showCardList()
		loadCards()
	} catch (err) {
		showToast(err.message, 'error')
	} finally {
		btnCardSubmit.disabled    = false
		btnCardSubmit.textContent = cardEditId.value ? 'Save Changes' : 'Save Card'
	}
})

//  Delete modal 
// Reuses the existing modal in console.html

const modalOverlay  = document.getElementById('modal-overlay')
const modalBody     = document.getElementById('modal-body')
const modalTitle    = document.querySelector('.modal-title')
const modalCancel   = document.getElementById('modal-cancel')
const modalConfirm  = document.getElementById('modal-confirm')

let pendingCardDeleteId = null

function openCardModal(name, id) {
	pendingCardDeleteId = id
	modalTitle.textContent = 'Delete this card?'
	modalBody.textContent  = `"${name}" will be permanently removed. This will fail if the card is still linked to an event pool or player collection.`
	modalOverlay.classList.remove('hidden')

	// Override the confirm handler just for this delete
	modalConfirm.onclick = doCardDelete
}

function closeModal() {
	pendingCardDeleteId     = null
	modalConfirm.onclick    = null
	modalOverlay.classList.add('hidden')
}

modalCancel.addEventListener('click', closeModal)
modalOverlay.addEventListener('click', (e) => {
	if (e.target === modalOverlay) closeModal()
})

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