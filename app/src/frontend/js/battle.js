import { api_base, showToast, toDatetimeLocal, buildCardBody } from './utils.js'
import { API_BASE, API_BASE_WS } from './constants.js'

var ws = null

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
const elBattlePlayerTurn = document.getElementById('turn-indicator')
const elBattleTurnNumber = document.getElementById('turn-number')
const elBattleOppCardsList = document.getElementById('opponent-cards')
const elBattlePlayerCardsList = document.getElementById('player-cards')
const elBattleLog = document.getElementById('battle-log')
const elBattleActions = document.getElementById('action-buttons')

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

function switchToResultView() {
	elCardSelectionView.classList.add('hidden')
	elLoginView.classList.add('hidden')
	elListError.classList.add('hidden')
	elResultView.classList.remove('hidden')
	elBattleView.classList.add('hidden')
}

function switchToLoginView() {
	elCardSelectionView.classList.add('hidden')
	elLoginView.classList.remove('hidden')
	elListError.classList.add('hidden')
	elResultView.classList.add('hidden')
	elBattleView.classList.add('hidden')
}

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

function createBattleCard(card) {
	const ATTRIBUTES = {
		ATK: 'stat_attack',
		LOC: 'stat_location',
		INF: 'stat_influence',
		LEG: 'stat_legacy',
		ERA: 'stat_era',
	}
	const li = document.createElement('li')
	li.setAttribute('class', 'battle-card')
	li.setAttribute('data-slot', card.slot_position)
	li.setAttribute('data-card-id', card.card_id)
	li.setAttribute('data-rarity', card.rarity.toUpperCase())

	const healthOuter = document.createElement('div')
	healthOuter.classList.add('battle-card-health-bar')
	const healthInner = document.createElement('div')
	healthInner.classList.add('battle-card-health-fill')
	healthInner.style.width = `${Math.round((card.health * 100) / card.stat_legacy)}%`
	healthOuter.appendChild(healthInner)
	li.appendChild(healthOuter)

	const add = document.createElement('div')
	add.classList.add('battle-card-additional')
	const category = document.createElement('span')
	category.classList.add('battle-card-category-tag')
	category.setAttribute('data-category', card.category)
	category.textContent = card.category
	add.appendChild(category)
	const rarityTag = document.createElement('span')
	rarityTag.classList.add('battle-card-rarity')
	rarityTag.setAttribute('data-rarity', card.rarity.toUpperCase())
	rarityTag.title = `${card.rarity.toUpperCase()} RARITY`
	rarityTag.textContent = '◆'
	add.appendChild(rarityTag)
	li.appendChild(add)

	const img = document.createElement('img')
	img.classList.add('battle-card-img')
	img.src = card.image_url
	li.appendChild(img)
	const name = document.createElement('p')
	name.classList.add('battle-card-name')
	name.textContent = card.name
	li.appendChild(name)

	const stats = document.createElement('ul')
	stats.classList.add('battle-card-stats')
	li.appendChild(stats)
	for (const [key, value] of Object.entries(ATTRIBUTES)) {
		const statsLi = document.createElement('li')
		stats.appendChild(statsLi)
		let span = document.createElement('span')
		span.textContent = key
		statsLi.appendChild(span)
		span = document.createElement('span')
		span.classList.add('stat-value')
		span.textContent = card[value]
		statsLi.appendChild(span)
	}

	return li
}

function refreshActions(category = null) {
	//   INFLUENCE -> BUFF / DEBUFF only
	//   CHARACTER -> ATTACK, highest damage
	//   LOCATION  -> ATTACK, but skews hit/dodge chance
	//   HISTORICAL -> ATTACK, plus reviving a defeated CHARACTER (not built yet)
	elBattleActions.replaceChildren()
	if (category === null) return
	const allowed = {
		CHARACTER: ['ATTACK', 'DEFEND'],
		LOCATION: ['ATTACK', 'DODGE', 'DEFEND'],
		INFLUENCE: ['ATTACK', 'BUFF', 'DEBUFF'],
		HISTORICAL: ['ATTACK', 'DEFEND'],
	}
	if (allowed[category] === undefined) return
	for (const action of allowed[category]) {
		const button = document.createElement('button')
		button.classList.add('btn')
		button.classList.add('btn-action')
		button.setAttribute('data-action', action)
		button.textContent = action
		elBattleActions.appendChild(button)
		button.addEventListener('click', actionEvent)
	}
}

let pendingAction = null
let pendingAttackerSlot = null
let pendingTargetType = null
const ACTION_TARGETS = {
	SELF: ['DEFEND', 'DODGE'],
	OPPONENT: ['ATTACK', 'DEBUFF'],
	TEAM: ['REVIVE', 'BUFF'],
}

function actionEvent(event) {
	const action = event.currentTarget.getAttribute('data-action')
	const attacker = document.body.querySelector(
		'#player-cards .battle-card.selected'
	)
	if (!attacker) return

	const attackerSlot = parseInt(attacker.getAttribute('data-slot'), 10)

	// 1. Instant execution for self-target actions
	if (ACTION_TARGETS.SELF.includes(action)) {
		sendAttack(attackerSlot, attackerSlot, action)
		clearSelectionState()
		return
	}

	// 2. Set pending targeting mode
	pendingAction = action
	pendingAttackerSlot = attackerSlot

	if (ACTION_TARGETS.OPPONENT.includes(action)) {
		pendingTargetType = 'OPPONENT'
		document.body.classList.add('awaiting-opponent-target')
	} else if (ACTION_TARGETS.TEAM.includes(action)) {
		pendingTargetType = 'TEAM'
		document.body.classList.add('awaiting-team-target')
	}

	renderCancelBanner(action)
}

function onCardClick(event) {
	const cardElement = event.currentTarget
	const isPlayerCard = cardElement.closest('#player-cards') !== null
	const isOpponentCard = cardElement.closest('#opponent-cards') !== null

	// --- TARGET INTERCEPTION ---
	if (pendingTargetType) {
		const clickedSlot = parseInt(
			cardElement.getAttribute('data-slot'),
			10
		)

		if (pendingTargetType === 'OPPONENT' && isOpponentCard) {
			sendAttack(
				pendingAttackerSlot,
				clickedSlot,
				pendingAction
			)
			clearSelectionState()
			return
		}

		if (pendingTargetType === 'TEAM' && isPlayerCard) {
			sendAttack(
				pendingAttackerSlot,
				clickedSlot,
				pendingAction
			)
			clearSelectionState()
			return
		}

		cancelTargeting()
	}

	if (cardElement.parentElement.getAttribute('id') === 'opponent-cards')
		return
	if (cardElement.classList.contains('selected')) {
		elBattleActions.replaceChildren()
		return cardElement.classList.remove('selected')
	}

	cardElement.parentElement
		.querySelector('.battle-card.selected')
		?.classList.remove('selected')

	cardElement.classList.add('selected')

	const category = cardElement
		.querySelector('.battle-card-category-tag')
		?.getAttribute('data-category')
	refreshActions(category)
}

function clearSelectionState() {
	cancelTargeting()
	document.querySelectorAll('.battle-card.selected').forEach((card) =>
		card.classList.remove('selected')
	)
	elBattleActions.replaceChildren()
}

function cancelTargeting() {
	pendingAction = null
	pendingAttackerSlot = null
	pendingTargetType = null
	document.body.classList.remove(
		'awaiting-opponent-target',
		'awaiting-team-target'
	)
}

function renderCancelBanner(action) {
	elBattleActions.replaceChildren()

	const banner = document.createElement('span')
	banner.classList.add('targeting-hint')
	banner.textContent = `Select ${pendingTargetType === 'OPPONENT' ? 'an Opponent' : 'a Teammate'} for ${action}`

	const cancelBtn = document.createElement('button')
	cancelBtn.classList.add('btn', 'btn-cancel')
	cancelBtn.textContent = 'Cancel'
	cancelBtn.addEventListener('click', () => {
		cancelTargeting()
		const attacker = document.body.querySelector(
			'#player-cards .battle-card.selected'
		)
		if (attacker) {
			const category = attacker
				.querySelector('.battle-card-category-tag')
				?.getAttribute('data-category')
			refreshActions(category)
		}
	})

	elBattleActions.appendChild(banner)
	elBattleActions.appendChild(cancelBtn)
}

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && pendingTargetType) {
		cancelTargeting()
		const attacker = document.body.querySelector(
			'#player-cards .battle-card.selected'
		)
		if (attacker) {
			const category = attacker
				.querySelector('.battle-card-category-tag')
				?.getAttribute('data-category')
			refreshActions(category)
		}
	}
})

function sendAttack(attacker_slot, target_slot, action) {
	if (!ws) return
	ws.send(
		JSON.stringify({
			type: 'attack',
			attacker_slot,
			target_slot,
			action,
		})
	)
}

function action_log(actor, target, result) {
	if (!result || !result.action) {
		return 'Invalid action log result.'
	}

	switch (result.action) {
		case 'ATTACK': {
			if (result.landed) {
				return `${actor} attacked ${target} dealing ${result.damage ?? 0} damage`
			}
			return `${actor} attacked ${target} and missed`
		}
		default:
			return `${actor} performed unknown action: ${result.action}`
	}
}

function refreshBattleLogs(
	player_result,
	player_cards,
	opponent_result,
	opponent_cards
) {
	var li, actor, target
	if (player_result) {
		li = document.createElement('li')
		li.classList.add('player-log')
		actor = player_cards[player_result.attacker_slot].name
		if (
			ACTION_TARGETS.SELF.includes(player_result.action) ||
			ACTION_TARGETS.TEAM.includes(player_result.action)
		)
			target = player_cards[player_result.target_slot].name
		else target = opponent_cards[player_result.target_slot].name
		li.textContent = action_log(
			`Player "${actor}"`,
			`Opponent "${target}"`,
			player_result
		)
		elBattleLog.appendChild(li)
	}
	if (opponent_result) {
		li = document.createElement('li')
		li.classList.add('opponent-log')
		actor = opponent_cards[opponent_result.attacker_slot].name
		if (
			ACTION_TARGETS.SELF.includes(opponent_result.action) ||
			ACTION_TARGETS.TEAM.includes(opponent_result.action)
		)
			target =
				opponent_cards[opponent_result.target_slot].name
		else target = player_cards[opponent_result.target_slot].name
		li.textContent = action_log(
			`Opponent "${actor}"`,
			`Player "${target}"`,
			opponent_result
		)
		elBattleLog.appendChild(li)
	}
}

function refreshBattleView(battle_id, user_id, state) {
	elBattleTurnNumber.textContent = state.turn_number
	elBattlePlayerTurn.textContent =
		state.turn === user_id ? 'Your turn' : "Opponent's turn"
	var player_cards, opponent_cards
	if (state.player1_id === user_id) {
		player_cards = state.cards.player1
		opponent_cards = state.cards.player2
	} else {
		player_cards = state.cards.player2
		opponent_cards = state.cards.player1
	}
	elBattlePlayerCardsList.replaceChildren()

	function selectCard(event) {
		const cardElement = event.currentTarget
		if (cardElement.classList.contains('selected')) {
			elBattleActions.replaceChildren()
			return cardElement.classList.remove('selected')
		}
		cardElement.parentElement
			.querySelector('.battle-card.selected')
			?.classList.remove('selected')
		cardElement.classList.add('selected')
	}
	for (const card of player_cards) {
		const cardElement = createBattleCard(card)
		if (card.health <= 0) cardElement.classList.add('dead')
		elBattlePlayerCardsList.appendChild(cardElement)
		cardElement.addEventListener('click', onCardClick)
	}
	elBattleOppCardsList.replaceChildren()
	for (const card of opponent_cards) {
		const cardElement = createBattleCard(card)
		if (card.health > 0) cardElement.classList.add('targetable')
		if (card.health <= 0) cardElement.classList.add('dead')
		elBattleOppCardsList.appendChild(cardElement)
		cardElement.addEventListener('click', onCardClick)
	}
}

function connectToWebSocket(battle_id) {
	try {
		let pingInterval
		ws = new WebSocket(`${API_BASE_WS}/ws/battle`)

		ws.onopen = () => {
			pingInterval = setInterval(() => {
				ws.send(JSON.stringify({ type: 'ping' }))
			}, 25000) // ping every 25 seconds
			ws.send(
				JSON.stringify({
					type: 'join_battle',
					battle_id,
				})
			)
		}
		ws.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data)
				if (data.type === 'pong') return
				console.log(data)
				if (
					data.state !== undefined &&
					data.user_id !== undefined
				)
					refreshBattleView(
						battle_id,
						data.user_id,
						data.state
					)
				if (data.type === 'turn_result') {
					let player_cards, opponent_cards
					if (
						data.state.player1_id ===
						data.user_id
					) {
						player_cards =
							data.state.cards.player1
						opponent_cards =
							data.state.cards.player2
					} else {
						player_cards =
							data.state.cards.player2
						opponent_cards =
							data.state.cards.player1
					}
					refreshBattleLogs(
						data.player_result,
						player_cards,
						data.opponent_result,
						opponent_cards
					)
				}
			} catch (err) {
				console.error(
					'Failed to parse incoming WebSocket message:',
					err
				)
			}
		}
		ws.onclose = () => {
			if (pingInterval) clearInterval(pingInterval)
			console.log('WebSocket disconnected')
		}
		ws.onerror = (error) => {
			console.error('WebSocket error:', error)
		}

		return ws
	} catch (err) {
		console.error(err)
		return null
	}
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
		if (ws) return
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
		const { battle_id } = await startBattleRes.json()
		if (!(await buildDeck(deck))) {
			setTimeout(() => {
				refreshDeck()
			}, 1000)
			return
		}
		ws = connectToWebSocket(battle_id)
		switchToBattleView()
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
			deckCard.cardElement = createBattleCard(deckCard.card)
			deckCard.cardElement
				.querySelector('.battle-card-health-bar')
				.remove()
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

async function loadSelectionEvents() {
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
			const li = createBattleCard(card)
			li.querySelector('.battle-card-health-bar').remove()
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
		const res1 = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (!res1.ok) throw new Error('Not authenticated')
		const user = await res1.json()

		elUserBadge.textContent = user.name
		elUserBadge.style.display = ''
		btnLogout.style.display = ''
		elBattleLog.replaceChildren()
		const res2 = await fetch(
			`${API_BASE}/api/battles/find-battle`,
			{
				credentials: 'include',
			}
		)
		if (res2.ok) {
			const battle_id = (await res2.json()).battle_id
			if (battle_id !== null) {
				console.log('id: ', battle_id)
				ws = connectToWebSocket(battle_id)
				switchToBattleView()
				return
			}
		}
		switchToCardSelectionView()
		refreshDeck()
		loadSelectionEvents()
	} catch {
		elLoginView.classList.remove('hidden')
	}
}

checkAccess()
