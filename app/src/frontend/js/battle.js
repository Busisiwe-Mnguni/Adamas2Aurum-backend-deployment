import { api_base, showToast, toDatetimeLocal, buildCardBody } from './utils.js'
import { API_BASE } from './constants.js'

const AUTHOR_ROLES = ['SUPER_ADMIN', 'EVENT_AUTHOR']
const AUTH_API = `${API_BASE}/api/auth`

const elLoginView = document.getElementById('login-view')
const elLoginForm = document.getElementById('login-form')
const elLoginError = document.getElementById('login-error')

const elCardSelectionView = document.getElementById('view-deck-select')
const elCardCollection = document.getElementById('collection-grid')
const elCardCollectionLoading = document.getElementById('deck-loading')
const elCardCollectionEmpty = document.getElementById('deck-empty')

const elBattleDeckSelection = document.getElementById('deck-slots')
const elBattleDeckCount = document.getElementById('deck-count')
const elBattleStart = document.getElementById('btn-start-battle')

const elBattleView = document.getElementById('view-battle')
const elResultView = document.getElementById('view-result')

const elListError = document.getElementById('list-error')

const elUserBadge = document.getElementById('user-badge')
const btnLogout = document.getElementById('btn-logout')

var battleDeckCount = 0
const battleDeck = [
	{
		element: document.querySelector(
			'#deck-slots .deck-slot[data-slot="1"]'
		),
		span: document.querySelector(
			'#deck-slots .deck-slot[data-slot="1"] span'
		),
		card: null,
		cardElement: null,
	},
	{
		element: document.querySelector(
			'#deck-slots .deck-slot[data-slot="2"]'
		),
		span: document.querySelector(
			'#deck-slots .deck-slot[data-slot="2"] span'
		),
		card: null,
		cardElement: null,
	},
	{
		element: document.querySelector(
			'#deck-slots .deck-slot[data-slot="3"]'
		),
		span: document.querySelector(
			'#deck-slots .deck-slot[data-slot="3"] span'
		),
		card: null,
		cardElement: null,
	},
	{
		element: document.querySelector(
			'#deck-slots .deck-slot[data-slot="4"]'
		),
		span: document.querySelector(
			'#deck-slots .deck-slot[data-slot="4"] span'
		),
		card: null,
		cardElement: null,
	},
	{
		element: document.querySelector(
			'#deck-slots .deck-slot[data-slot="5"]'
		),
		span: document.querySelector(
			'#deck-slots .deck-slot[data-slot="5"] span'
		),
		card: null,
		cardElement: null,
	},
]

const f = (id) => document.getElementById(id)

async function doLogout() {
	await fetch(`${AUTH_API}/logout`, {
		method: 'POST',
		credentials: 'include',
	})
	elCardSelectionView.classList.add('hidden')
	elBattleView.classList.add('hidden')
	elResultView.style.display = 'none'

	btnLogout.style.display = 'none'
	elLoginView.classList.remove('hidden')

	elListError.classList.add('hidden')
}

btnLogout.addEventListener('click', doLogout)

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

function switchToCardSelectionView() {
	elCardSelectionView.classList.remove('hidden')
	elLoginView.classList.add('hidden')
	elListError.classList.add('hidden')
	elResultView.classList.add('hidden')
	elBattleView.classList.add('hidden')
}

function switchToBattleView(deck) {
	elCardSelectionView.classList.add('hidden')
	elLoginView.classList.add('hidden')
	elListError.classList.add('hidden')
	elResultView.classList.add('hidden')
	elBattleView.classList.remove('hidden')
}

async function verifyBattleEligibility(deck) {
	try {
		const res = await fetch(`${API_BASE}/api/cards/valid-cards`, {
			method: 'POST',
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(deck),
		})
		const data = await res.json()
		if (!res.ok) {
			console.error(data.error)
			return false
		}

		return data
	} catch (err) {
		console.error(err)
		return false
	}
}

async function buildDeck(deck) {
	try {
		const res = await fetch(
			`${API_BASE}/api/battles/build-battle-deck`,
			{
				credentials: 'include',
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(deck),
			}
		)
		const data = await res.json()
		if (!res.ok) {
			console.error(data.error)
			return false
		}
		return data
	} catch (err) {
		console.error(err)
		return false
	}
}

async function startBattle(deck) {
	try {
		elBattleStart.disabled = true
		if (!(await verifyBattleEligibility(deck))) {
			setTimeout(() => {
				refreshDeck()
			}, 1000)
			return
		}
		const startBattleRes = await fetch(
			`${API_BASE}/api/battles/start-battle?npc=1`,
			{
				credentials: 'include',
				method: 'GET',
			}
		)
		if (!startBattleRes.ok) {
			console.error((await startBattleRes.json()).error)
			setTimeout(() => {
				refreshDeck()
			}, 1000)
			return
		}
		if (!(await buildDeck(deck))) {
			setTimeout(() => {
				refreshDeck()
			}, 1000)
			return
		}
		switchToBattleView();
	} catch {}
}

function alignDeck() {
	var space = 0
	for (const [idx, deckCard] of battleDeck.entries()) {
		if (deckCard.card == null) {
			space++
		} else if (space > 0) {
			battleDeck[idx - space].card = deckCard.card

			deckCard.card = null

			if (deckCard.cardElement != null) {
				deckCard.cardElement.remove()
				deckCard.cardElement = null
			}
		}
	}
}

function refreshDeck() {
	battleDeckCount = 0
	for (const deckCard of battleDeck) {
		if (deckCard.card == null) {
			deckCard.span.classList.remove('hidden')
			if (deckCard.cardElement != null)
				deckCard.cardElement.remove()
			continue
		}
		if (deckCard.cardElement == null) {
			deckCard.cardElement = buildCard(deckCard.card)
			deckCard.cardElement.addEventListener('click', () => {
				deckCard.cardElement.remove()
				deckCard.card = null
				deckCard.cardElement = null
				deckCard.span.classList.remove('hidden')
				alignDeck()
				refreshDeck()
			})
		}
		deckCard.span.classList.add('hidden')
		deckCard.element.appendChild(deckCard.cardElement)
		battleDeckCount += 1
	}
	elBattleDeckCount.textContent = battleDeckCount
	if (battleDeckCount == 5) elBattleStart.disabled = false
	else elBattleStart.disabled = true
}

function addToDeck(card) {
	for (const deckCard of battleDeck) {
		if (
			deckCard.card != null &&
			card.card_id == deckCard.card.card_id
		)
			return
	}
	for (const deckCard of battleDeck) {
		if (deckCard.card == null) {
			deckCard.card = card
			break
		}
	}
	alignDeck()
	refreshDeck()
}

function buildCard(card) {
	const li = document.createElement('li')
	li.classList.add('card-tile')

	const name = document.createElement('h2')
	name.classList.add('card-tile-name')
	name.textContent = card.name
	li.appendChild(name)
	const rarity = document.createElement('p')
	rarity.classList.add('card-tile-rarity')
	rarity.textContent = card.rarity
	li.appendChild(rarity)
	const badge = document.createElement('p')
	badge.classList.add('card-tile-badge')
	badge.textContent = card.category
	li.appendChild(badge)

	const image = document.createElement('img')
	image.src = card.image_url
	li.appendChild(image)

	return li
}

async function loadEvents() {
	elListError.classList.add('hidden')
	try {
		const res = await fetch(`${API_BASE}/api/cards/get-all`, {
			credentials: 'include',
		})
		const data = await res.json()
		if (!res.ok) {
			console.error(data.error)
			throw new Error(`Server responded with ${res.status}`)
		}

		elCardCollectionLoading.classList.add('hidden')
		if (data.length == 0)
			elCardCollectionEmpty.classList.remove('hidden')

		for (const card of data) {
			const li = buildCard(card)
			elCardCollection.appendChild(li)
			li.addEventListener('click', (el) => addToDeck(card))
		}

		elBattleStart.addEventListener('click', () =>
			startBattle(battleDeck.map((x) => x.card))
		)
	} catch (err) {
		elListError.textContent = `Could not load events — ${err.message}`
		elListError.classList.remove('hidden')
	}
}

async function checkAccess() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error('Not authenticated')
		const user = await res.json()

		elUserBadge.textContent = user.name
		elUserBadge.style.display = ''
		btnLogout.style.display = ''
		switchToCardSelectionView();
		refreshDeck()
		loadEvents()
	} catch {
		elLoginView.classList.remove('hidden')
	}
}

checkAccess()
