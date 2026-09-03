import { API_BASE } from './constants.js'
import { updateAuthNav } from './auth-helpers.js'

const AUTH_API  = `${API_BASE}/api/auth`
const CARDS_API = `${API_BASE}/api/cards`

//  DOM refs 
const elContent     = document.getElementById('collection-content')
const elLoading     = document.getElementById('loading')
const elEmpty       = document.getElementById('empty')
const elError       = document.getElementById('error')
const elCardList    = document.getElementById('card-list')
const elSubtitle    = document.getElementById('collection-subtitle')
const elFilters     = document.getElementById('collection-filters')
const btnLogout = document.getElementById('btn-logout')
const filterCat     = document.getElementById('filter-category')
const filterRarity  = document.getElementById('filter-rarity')

//  Auth 

btnLogout.addEventListener('click', async () => {
  await fetch(`${AUTH_API}/logout`, { method: 'POST', credentials: 'include' });
  window.location.href = '../index.html';
});

async function checkAccess() {
	try {
		const res = await fetch(`${AUTH_API}/me`, { credentials: 'include' })
		if (!res.ok) throw new Error('Not authenticated')
		const user = await res.json()

		updateAuthNav(user)
		elContent.classList.remove('hidden')

		loadCollection()
	} catch {
		// Single login entry point: send unauthenticated users to the landing page.
		window.location.href = '../index.html'
	}
}

//  Load collection 

let allCards = []

async function loadCollection() {
	elLoading.classList.remove('hidden')
	elEmpty.classList.add('hidden')
	elError.classList.add('hidden')
	elCardList.innerHTML = ''
	elSubtitle.textContent = 'Loading…'
	elFilters.style.display = 'none'

	try {
		const res = await fetch(`${CARDS_API}/collection/mine`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error(`Server responded with ${res.status}`)
		allCards = await res.json()

		elLoading.classList.add('hidden')

		if (!allCards.length) {
			elEmpty.classList.remove('hidden')
			elSubtitle.textContent = '0 cards'
			return
		}

		elSubtitle.textContent  = `${allCards.length} card${allCards.length !== 1 ? 's' : ''} collected`
		elFilters.style.display = ''
		renderCards(allCards)
	} catch (err) {
		elLoading.classList.add('hidden')
		elError.textContent = `Could not load your collection — ${err.message}`
		elError.classList.remove('hidden')
	}
}

// Filtering 

filterCat.addEventListener('change',    applyFilters)
filterRarity.addEventListener('change', applyFilters)

function applyFilters() {
	const cat    = filterCat.value
	const rarity = filterRarity.value

	const filtered = allCards.filter((card) => {
		if (cat    && card.category !== cat)    return false
		if (rarity && card.rarity   !== rarity) return false
		return true
	})

	elCardList.innerHTML = ''

	if (!filtered.length) {
		elEmpty.classList.remove('hidden')
	} else {
		elEmpty.classList.add('hidden')
		renderCards(filtered)
	}
}

//  Render 

function renderCards(cards) {
	cards.forEach((card) => elCardList.appendChild(buildCollectionCard(card)))
}

const RARITY_COLOURS = {
	COMMON:    'var(--text-muted)',
	RARE:      '#60a5fa',
	LEGENDARY: '#f59e0b',
}

const RARITY_LABELS = {
	COMMON:    'Common',
	RARE:      'Rare ✦',
	LEGENDARY: 'Legendary ✦✦',
}

const CATEGORY_ROLES = {
	CHARACTER:  'Attacker',
	LOCATION:   'Evasion',
	INFLUENCE:  'Buff / Debuff',
	HISTORICAL: 'Revive',
}

function buildCollectionCard(card) {
	const li = document.createElement('li')
	li.className = 'collection-card'

	const rarityColour = RARITY_COLOURS[card.rarity] ?? 'inherit'
	const rarityLabel  = RARITY_LABELS[card.rarity]  ?? card.rarity
	const roleLabel    = CATEGORY_ROLES[card.category] ?? card.category

	const obtainedDate = new Date(card.obtained_at).toLocaleDateString(
		undefined,
		{ year: 'numeric', month: 'short', day: 'numeric' }
	)

	li.innerHTML = `
		<div class="cc-header" style="border-top: 3px solid ${rarityColour};">
			${card.image_url
				? `<img class="cc-image" src="${card.image_url}" alt="${card.name}" />`
				: `<div class="cc-image-placeholder">${card.name.charAt(0)}</div>`
			}
			<div class="cc-title-block">
				<div class="cc-name">${card.name}</div>
				<div class="cc-rarity" style="color:${rarityColour};">${rarityLabel}</div>
			</div>
		</div>

		<div class="cc-body">
			<div class="cc-category">${card.category} — <span class="cc-role">${roleLabel}</span></div>

			${card.flavour_text
				? `<p class="cc-flavour">"${card.flavour_text}"</p>`
				: ''
			}

			<div class="cc-stats">
				<div class="cc-stat"><span class="cc-stat-label">ATK</span><span class="cc-stat-value">${card.stat_attack}</span></div>
				<div class="cc-stat"><span class="cc-stat-label">LOC</span><span class="cc-stat-value">${card.stat_location}</span></div>
				<div class="cc-stat"><span class="cc-stat-label">INF</span><span class="cc-stat-value">${card.stat_influence}</span></div>
				<div class="cc-stat"><span class="cc-stat-label">LEG</span><span class="cc-stat-value">${card.stat_legacy}</span></div>
				<div class="cc-stat"><span class="cc-stat-label">ERA</span><span class="cc-stat-value">${card.stat_era}</span></div>
			</div>

			${card.ability_name
				? `<div class="cc-ability">
						<span class="cc-ability-name">⚡ ${card.ability_name}</span>
						${card.ability_desc ? `<span class="cc-ability-desc"> — ${card.ability_desc}</span>` : ''}
					</div>`
				: ''
			}
		</div>

		<div class="cc-footer">
			Obtained ${obtainedDate}
			${card.quantity > 1 ? `<span class="cc-qty">×${card.quantity}</span>` : ''}
		</div>
	`

	return li
}

checkAccess()