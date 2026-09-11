import { API_BASE } from './constants.js'

const PAGE_SIZE = 50

// ── DOM ──────────────────────────────────────────────────────
const elState = document.getElementById('lb-state')
const elTable = document.getElementById('lb-table')
const elTbody = document.getElementById('lb-tbody')
const elPagination = document.getElementById('lb-pagination')
const elPrev = document.getElementById('lb-prev')
const elNext = document.getElementById('lb-next')
const elPageLabel = document.getElementById('lb-page-label')

const elMyRankCard = document.getElementById('my-rank-card')
const elMyRankPosition = document.getElementById('my-rank-position')
const elMyRankPoints = document.getElementById('my-rank-points')
const elMyRankMeta = document.getElementById('my-rank-meta')

const elAnonBanner = document.getElementById('anon-banner')
const elUserBadge = document.getElementById('user-badge')
const elBtnLogout = document.getElementById('btn-logout')
const elBtnSignin = document.getElementById('btn-signin')

// ── State ────────────────────────────────────────────────────
let currentOffset = 0
let currentTotal = 0
let currentUser = null

// ── Utilities ────────────────────────────────────────────────
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

function initialsAvatar(name) {
	const safe = escapeHtml(name || '?')
	const initial = (name || '?').trim().charAt(0).toUpperCase()
	return `<span class="lb-avatar" aria-hidden="true">${escapeHtml(initial)}</span>`
}

// ── Auth check ───────────────────────────────────────────────
async function checkAuth() {
	try {
		const res = await fetch(`${API_BASE}/api/me`, {
			credentials: 'include',
		})
		if (!res.ok) throw new Error()
		currentUser = await res.json()
	} catch {
		currentUser = null
	}
	renderAuthUI()
}

function renderAuthUI() {
	if (currentUser) {
		elAnonBanner?.classList.add('hidden')
		elBtnSignin?.classList.add('hidden')
		elBtnLogout?.classList.remove('hidden')
		if (elUserBadge) {
			elUserBadge.textContent = currentUser.name || ''
			elUserBadge.classList.remove('hidden')
		}
		// Anyone with an authoring role sees the Console link.
		if (
			currentUser.role === 'SUPER_ADMIN' ||
			currentUser.role === 'EVENT_AUTHOR'
		) {
			document.getElementById(
				'nav-console'
			)?.classList.remove('hidden')
		}
	} else {
		elAnonBanner?.classList.remove('hidden')
		elBtnSignin?.classList.remove('hidden')
		elBtnLogout?.classList.add('hidden')
		elUserBadge?.classList.add('hidden')
	}

	elBtnLogout?.addEventListener('click', async () => {
		try {
			await fetch(`${API_BASE}/api/auth/logout`, {
				method: 'POST',
				credentials: 'include',
			})
		} catch {
			/* ignore */
		}
		window.location.href = '../index.html'
	})
}

// ── Leaderboard list ─────────────────────────────────────────
async function loadLeaderboard(offset = 0) {
	setState('Loading leaderboard…', false)
	elTable.classList.add('hidden')
	elPagination.classList.add('hidden')

	try {
		const res = await fetch(
			`${API_BASE}/api/leaderboard?limit=${PAGE_SIZE}&offset=${offset}`,
			{ credentials: 'include', cache: 'no-store' }
		)
		if (!res.ok) {
			throw new Error(`Server responded with ${res.status}`)
		}
		const data = await res.json()

		currentOffset = data.offset
		currentTotal = data.total

		if (!data.entries.length) {
			setState('No players on the board yet.', false)
			return
		}

		renderRows(data.entries)
		renderPagination()
		setState('', true)
		elTable.classList.remove('hidden')
	} catch (err) {
		setState(`Could not load leaderboard — ${err.message}`, true)
	}
}

function setState(msg, isError) {
	if (!msg) {
		elState.classList.add('hidden')
		return
	}
	elState.textContent = msg
	elState.classList.remove('hidden')
	elState.classList.toggle('error', !!isError)
}

function renderRows(entries) {
	elTbody.innerHTML = ''
	for (const e of entries) {
		const tr = document.createElement('tr')
		const isMe = currentUser && currentUser.user_id === e.user_id
		if (isMe) tr.classList.add('lb-row-me')

		tr.innerHTML = `
			<td class="lb-col-rank">
				<span class="lb-rank lb-rank-${rankClass(e.rank)}">${e.rank}</span>
			</td>
			<td>
				<div class="lb-player">
					${initialsAvatar(e.name)}
					<span class="lb-player-name">${escapeHtml(e.name)}</span>
					${isMe ? '<span class="lb-you-pill">You</span>' : ''}
				</div>
			</td>
			<td class="lb-col-num lb-points">${e.points}</td>
			<td class="lb-col-num lb-col-hide-sm">${e.wins}</td>
			<td class="lb-col-num lb-col-hide-sm">${e.losses}</td>
		`
		elTbody.appendChild(tr)
	}
}

function rankClass(rank) {
	if (rank === 1) return 'gold'
	if (rank === 2) return 'silver'
	if (rank === 3) return 'bronze'
	return 'plain'
}

function renderPagination() {
	const start = currentOffset + 1
	const end = Math.min(currentOffset + PAGE_SIZE, currentTotal)
	elPageLabel.textContent = `Showing ${start}–${end} of ${currentTotal}`

	elPrev.disabled = currentOffset === 0
	elNext.disabled = end >= currentTotal

	elPagination.classList.remove('hidden')

	elPrev.onclick = () => {
		if (currentOffset === 0) return
		loadLeaderboard(Math.max(0, currentOffset - PAGE_SIZE))
	}
	elNext.onclick = () => {
		if (end >= currentTotal) return
		loadLeaderboard(currentOffset + PAGE_SIZE)
	}
}

// ── My rank card ─────────────────────────────────────────────
async function loadMyRank() {
	if (!currentUser) return
	try {
		const res = await fetch(`${API_BASE}/api/leaderboard/me`, {
			credentials: 'include',
		})
		if (!res.ok) return
		const data = await res.json()

		elMyRankPosition.textContent = `#${data.rank}`
		elMyRankPoints.textContent = data.points
		elMyRankMeta.textContent = `out of ${data.total_players} players`
		elMyRankCard.classList.remove('hidden')
	} catch {
		/* non-fatal — list still shows */
	}
}

// ── Boot ─────────────────────────────────────────────────────
await checkAuth()
await loadLeaderboard(0)
await loadMyRank()
