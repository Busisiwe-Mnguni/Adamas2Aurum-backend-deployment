import { API_BASE } from './constants.js'
import { showToast } from './utils.js'

const EVENTS_API = `${API_BASE}/api/events`
const AUTH_API = `${API_BASE}/api/auth`

const CONFIG = {
	CENTER_COORDINATES: [-26.1905, 28.0285],
	DEFAULT_ZOOM: 16.5,
	MIN_ZOOM: 16,
	MAX_ZOOM: 19,
	BOUNDS: [
		[-26.1945, 28.021],
		[-26.1835, 28.034],
	],
	TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
	TILE_ATTRIBUTION:
		'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

const CAMPUS_LANDMARKS = [
	{
		id: 'bldg_001',
		name: 'Great Hall',
		campus: 'East Campus',
		category: 'Landmark',
		description:
			'🏛️ Central graduation hall & core architectural landmark.',
		coordinates: [-26.1925, 28.0305],
	},
	{
		id: 'bldg_002',
		name: 'Solomon Mahlangu House',
		campus: 'East Campus',
		category: 'Administration',
		description:
			'🏢 Main administrative concourse and student services.',
		coordinates: [-26.1932, 28.0305],
	},
	{
		id: 'bldg_003',
		name: 'Robert Sobukwe Block',
		campus: 'East Campus',
		category: 'Academic',
		description:
			'🏫 Major lecture halls and central academic facilities.',
		coordinates: [-26.1928, 28.0301],
	},
	{
		id: 'bldg_004',
		name: 'William Cullen Library',
		campus: 'East Campus',
		category: 'Library',
		description:
			'📚 Historic central library overlooking Library Lawns.',
		coordinates: [-26.1918, 28.0298],
	},
	{
		id: 'bldg_005',
		name: 'Wartenweiler Library',
		campus: 'East Campus',
		category: 'Library',
		description: '📖 Primary 24-hour undergraduate study library.',
		coordinates: [-26.1918, 28.0311],
	},
	{
		id: 'bldg_006',
		name: 'The Matrix',
		campus: 'East Campus',
		category: 'Student Hub',
		description:
			'🍔 Central student food court, shops, and social hub.',
		coordinates: [-26.1905, 28.0315],
	},
	{
		id: 'bldg_007',
		name: 'Umthombo Building',
		campus: 'East Campus',
		category: 'Academic & Labs',
		description:
			'💻 Major lecture theatre complex and central computer labs.',
		coordinates: [-26.1912, 28.0312],
	},
	{
		id: 'bldg_008',
		name: 'John Moffat Building',
		campus: 'East Campus',
		category: 'Architecture & Design',
		description:
			'📐 School of Architecture, Planning, and Fine Arts.',
		coordinates: [-26.191, 28.0291],
	},
	{
		id: 'bldg_009',
		name: 'North West Engineering',
		campus: 'East Campus',
		category: 'Engineering Faculty',
		description:
			'⚙️ Mechanical & Aeronautical Engineering laboratories.',
		coordinates: [-26.192, 28.0289],
	},
	{
		id: 'bldg_010',
		name: 'South West Engineering',
		campus: 'East Campus',
		category: 'Engineering Faculty',
		description:
			'⚡ Electrical, Information & Civil Engineering offices.',
		coordinates: [-26.1927, 28.0292],
	},
	{
		id: 'bldg_011',
		name: 'Physics Building',
		campus: 'East Campus',
		category: 'Science Faculty',
		description:
			'🔭 Department of Physics laboratories and lecture halls.',
		coordinates: [-26.1926, 28.0315],
	},
	{
		id: 'bldg_012',
		name: 'Humphrey Raikes Building',
		campus: 'East Campus',
		category: 'Science Faculty',
		description: '🧪 School of Chemistry research facilities.',
		coordinates: [-26.193, 28.0315],
	},
	{
		id: 'bldg_013',
		name: 'Oppenheimer Life Sciences Building',
		campus: 'East Campus',
		category: 'Science Faculty',
		description:
			'🔬 Biological & Environmental Sciences research complex.',
		coordinates: [-26.1922, 28.032],
	},
	{
		id: 'bldg_014',
		name: 'Gate House',
		campus: 'East Campus',
		category: 'Administration & Entrance',
		description:
			'🚪 Main University Avenue entrance and visitor control.',
		coordinates: [-26.1931, 28.0322],
	},
	{
		id: 'bldg_015',
		name: 'Wits School of Arts (WSOA)',
		campus: 'East Campus',
		category: 'Arts & Media',
		description:
			'🎨 Fine Arts, Film, Television, and Music departments.',
		coordinates: [-26.1935, 28.0325],
	},
	{
		id: 'bldg_016',
		name: 'Chris Seabrooke Music Hall',
		campus: 'East Campus',
		category: 'Arts & Media',
		description:
			'🎶 Concert venue for Wits Music recitals & performances.',
		coordinates: [-26.193, 28.0324],
	},
	{
		id: 'bldg_017',
		name: 'Old Mutual Sports Hall',
		campus: 'East Campus',
		category: 'Sports & Athletics',
		description: '🏀 Wits Sport Multipurpose indoor sports arena.',
		coordinates: [-26.1902, 28.0294],
	},
	{
		id: 'bldg_018',
		name: 'Bidvest Stadium',
		campus: 'East Campus',
		category: 'Sports & Athletics',
		description:
			'⚽ Multipurpose sports stadium, former home of Bidvest Wits FC.',
		coordinates: [-26.1882, 28.0287],
	},
	{
		id: 'bldg_019',
		name: 'Origins Centre',
		campus: 'East Campus',
		category: 'Museum',
		description: '🦴 Museum of human origins and African rock art.',
		coordinates: [-26.1936, 28.0328],
	},
	{
		id: 'bldg_020',
		name: 'Wits Art Museum (WAM)',
		campus: 'East Campus',
		category: 'Museum',
		description:
			"🖼️ Public gallery housing Wits' African art collection.",
		coordinates: [-26.1942, 28.0331],
	},
	{
		id: 'bldg_021',
		name: 'Wits Theatre',
		campus: 'East Campus',
		category: 'Arts & Media',
		description:
			'🎭 Main stage for Wits Theatre & Drama for Life productions.',
		coordinates: [-26.1938, 28.0326],
	},
	{
		id: 'bldg_022',
		name: 'Bernard Price Building',
		campus: 'East Campus',
		category: 'Science Faculty',
		description: '🌋 Geophysics and seismology research institute.',
		coordinates: [-26.1934, 28.0318],
	},
	{
		id: 'bldg_023',
		name: 'Geosciences Building',
		campus: 'East Campus',
		category: 'Science Faculty',
		description:
			'🪨 School of Geosciences labs and lecture venues.',
		coordinates: [-26.1932, 28.0315],
	},
	{
		id: 'bldg_024',
		name: 'Johannesburg Planetarium',
		campus: 'East Campus',
		category: 'Landmark',
		description:
			'🌌 Public planetarium and astronomy shows on East Campus.',
		coordinates: [-26.1895, 28.031],
	},
	{
		id: 'bldg_025',
		name: "Men's Residence (David Webster Hall East)",
		campus: 'East Campus',
		category: 'Student Residence',
		description: "🛏️ Traditional men's residence hall.",
		coordinates: [-26.1901, 28.0322],
	},
	{
		id: 'bldg_026',
		name: 'Jubilee Hall',
		campus: 'East Campus',
		category: 'Student Residence',
		description:
			'🛏️ Student residence near East Campus sports fields.',
		coordinates: [-26.1896, 28.0318],
	},
	{
		id: 'bldg_027',
		name: 'College House',
		campus: 'East Campus',
		category: 'Student Residence',
		description: '🛏️ Mixed student residence on East Campus.',
		coordinates: [-26.1892, 28.0321],
	},
	{
		id: 'bldg_101',
		name: 'FNB Building / School of Accountancy',
		campus: 'West Campus',
		category: 'Commerce',
		description: '📊 School of Accountancy & Finance auditoriums.',
		coordinates: [-26.1898, 28.0255],
	},
	{
		id: 'bldg_102',
		name: 'Oliver Schreiner School of Law',
		campus: 'West Campus',
		category: 'Law Faculty',
		description: '⚖️ Law library, Chalsty Centre, and law courts.',
		coordinates: [-26.1904, 28.0248],
	},
	{
		id: 'bldg_103',
		name: 'Wits Business Sciences',
		campus: 'West Campus',
		category: 'Commerce',
		description: '💼 School of Business Sciences & Economics.',
		coordinates: [-26.191, 28.0255],
	},
	{
		id: 'bldg_104',
		name: 'Science Stadium Auditoriums',
		campus: 'West Campus',
		category: 'Science',
		description:
			'🔬 Large lecture stadium complex for foundational sciences.',
		coordinates: [-26.1925, 28.0242],
	},
	{
		id: 'bldg_105',
		name: 'TW Kambule Mathematical Sciences',
		campus: 'West Campus',
		category: 'Mathematics',
		description:
			'📐 School of Mathematics & Computational Sciences.',
		coordinates: [-26.1926, 28.0252],
	},
	{
		id: 'bldg_106',
		name: 'Chamber of Mines Building',
		campus: 'West Campus',
		category: 'Engineering',
		description:
			'⛏️ Mining Engineering research labs and classrooms.',
		coordinates: [-26.1934, 28.0258],
	},
	{
		id: 'bldg_107',
		name: 'Commerce Library',
		campus: 'West Campus',
		category: 'Library',
		description:
			'📚 Dedicated library for Commerce, Law & Management students.',
		coordinates: [-26.1908, 28.0248],
	},
	{
		id: 'bldg_108',
		name: 'Law Clinic',
		campus: 'West Campus',
		category: 'Law Faculty',
		description:
			'⚖️ Free legal aid clinic run by Wits Law students.',
		coordinates: [-26.1906, 28.0246],
	},
	{
		id: 'bldg_109',
		name: 'CCDU (Counselling & Careers Development Unit)',
		campus: 'West Campus',
		category: 'Student Support',
		description:
			'🧠 Student counselling, wellness, and careers services.',
		coordinates: [-26.1928, 28.0256],
	},
	{
		id: 'bldg_110',
		name: 'Metro Bus Depot',
		campus: 'West Campus',
		category: 'Transport',
		description:
			'🚌 Campus shuttle & Metrobus stop for student transport.',
		coordinates: [-26.192, 28.0232],
	},
	{
		id: 'bldg_111',
		name: 'West Campus Village',
		campus: 'West Campus',
		category: 'Student Residence',
		description:
			'🏘️ Large self-catering student residence complex.',
		coordinates: [-26.1888, 28.0235],
	},
	{
		id: 'bldg_112',
		name: 'Sturrock Park',
		campus: 'West Campus',
		category: 'Sports & Athletics',
		description:
			'🏈 Sports fields used for rugby, football & athletics.',
		coordinates: [-26.1945, 28.0215],
	},
	{
		id: 'bldg_113',
		name: 'David Webster Hall',
		campus: 'West Campus',
		category: 'Student Residence',
		description: '🛏️ West Campus student residence.',
		coordinates: [-26.1888, 28.0252],
	},
	{
		id: 'bldg_114',
		name: 'Barnato Hall',
		campus: 'West Campus',
		category: 'Student Residence',
		description:
			'🛏️ Student residence overlooking Gavin Relly Green.',
		coordinates: [-26.1885, 28.0242],
	},
]

async function fetchMapEvents() {
	try {
		const response = await fetch(EVENTS_API, {
			credentials: 'include',
		})
		if (!response.ok) throw new Error(`HTTP ${response.status}`)
		return await response.json()
	} catch (error) {
		console.warn(
			'[map] Could not fetch events from API:',
			error.message
		)
		return []
	}
}

function formatTimeWindow(event) {
	const parts = []
	if (event.starts_at) {
		parts.push(
			`From ${new Date(event.starts_at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
		)
	}
	if (event.ends_at) {
		parts.push(
			`Until ${new Date(event.ends_at).toLocaleString('en-ZA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
		)
	}
	return parts.length ? parts.join(' — ') : 'Always active'
}

function buildLandmarkPopup(building) {
	return `
    <div class="event-popup">
      <h3>${building.name}</h3>
      <p>${building.description}</p>
      <span class="location-tag">${building.campus} &bull; ${building.category}</span>
    </div>
  `
}

function buildEventPopup(event) {
	return `
    <div class="event-popup">
      <h3>${event.title}</h3>
      <p>${event.description || 'No description.'}</p>
      <span class="location-tag">📍 ${event.radius_meters}m radius &bull; ⚡ ${event.point_reward} pts</span>
      <p style="margin-top:6px;font-size:0.8rem;color:#666;">${formatTimeWindow(event)}</p>
      ${event.point_threshold > 0 ? `<p style="font-size:0.8rem;color:#666;">🔒 ${event.point_threshold} pts to unlock</p>` : ''}
      <p style="margin-top:8px;font-size:0.78rem;color:#0c2461;font-weight:600;">Sign in to attempt this challenge →</p>
    </div>
  `
}

const LANDMARK_ICON = L.divIcon({
	className: 'landmark-marker',
	html: '<div style="width:10px;height:10px;background:#999;border:2px solid #666;border-radius:50%;"></div>',
	iconSize: [14, 14],
	iconAnchor: [7, 7],
})

const EVENT_ICON = L.divIcon({
	className: 'event-marker',
	html: '<div style="width:16px;height:16px;background:#f1c40f;border:2px solid #0c2461;border-radius:50%;box-shadow:0 0 6px rgba(241,196,15,0.6);"></div>',
	iconSize: [20, 20],
	iconAnchor: [10, 10],
})

async function checkAuthAndRedirect() {
	try {
		const res = await fetch(`${AUTH_API}/me`, {
			credentials: 'include',
		})
		if (res.ok) {
			window.location.href = 'events.html'
		}
	} catch {
		/* not logged in — stay on landing */
	}
}

function initAuthForms() {
	const tabSignin = document.getElementById('tab-signin')
	const tabSignup = document.getElementById('tab-signup')
	const signinForm = document.getElementById('signin-form')
	const signupForm = document.getElementById('signup-form')

	function showTab(tab) {
		const isSignin = tab === 'signin'
		tabSignin.classList.toggle('active', isSignin)
		tabSignup.classList.toggle('active', !isSignin)
		signinForm.classList.toggle('hidden', !isSignin)
		signupForm.classList.toggle('hidden', isSignin)
	}

	tabSignin.addEventListener('click', () => showTab('signin'))
	tabSignup.addEventListener('click', () => showTab('signup'))

	signinForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		const errEl = document.getElementById('signin-error')
		const btn = document.getElementById('btn-signin')
		errEl.classList.add('hidden')
		const email = document
			.getElementById('signin-email')
			.value.trim()
		const pin = document.getElementById('signin-pin').value
		if (!email || !pin) {
			errEl.textContent = 'Email and PIN are required.'
			errEl.classList.remove('hidden')
			return
		}
		btn.disabled = true
		btn.textContent = 'Signing in…'
		try {
			const res = await fetch(`${AUTH_API}/login`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, pin }),
			})
			const data = await res.json()
			if (!res.ok)
				throw new Error(data.error || 'Login failed')
			window.location.href = 'events.html'
		} catch (err) {
			errEl.textContent = err.message
			errEl.classList.remove('hidden')
		} finally {
			btn.disabled = false
			btn.textContent = 'Sign in'
		}
	})

	signupForm.addEventListener('submit', async (e) => {
		e.preventDefault()
		const errEl = document.getElementById('signup-error')
		const btn = document.getElementById('btn-signup')
		errEl.classList.add('hidden')
		const name = document.getElementById('signup-name').value.trim()
		const email = document
			.getElementById('signup-email')
			.value.trim()
		const pin = document.getElementById('signup-pin').value
		const pin2 = document.getElementById('signup-pin2').value
		if (!name || !email || !pin) {
			errEl.textContent = 'All fields are required.'
			errEl.classList.remove('hidden')
			return
		}
		if (pin.length < 4) {
			errEl.textContent = 'PIN must be at least 4 characters.'
			errEl.classList.remove('hidden')
			return
		}
		if (pin !== pin2) {
			errEl.textContent = 'PINs do not match.'
			errEl.classList.remove('hidden')
			return
		}
		btn.disabled = true
		btn.textContent = 'Creating…'
		try {
			const res = await fetch(`${AUTH_API}/register`, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, email, pin }),
			})
			const data = await res.json()
			if (!res.ok)
				throw new Error(data.error || 'Sign up failed')
			window.location.href = 'events.html'
		} catch (err) {
			errEl.textContent = err.message
			errEl.classList.remove('hidden')
		} finally {
			btn.disabled = false
			btn.textContent = 'Create account'
		}
	})
}

async function initializeApp() {
	checkAuthAndRedirect()
	initAuthForms()

	const map = L.map('map', {
		center: CONFIG.CENTER_COORDINATES,
		zoom: CONFIG.DEFAULT_ZOOM,
		minZoom: CONFIG.MIN_ZOOM,
		maxZoom: CONFIG.MAX_ZOOM,
		maxBounds: CONFIG.BOUNDS,
		maxBoundsViscosity: 1.0,
	})

	L.tileLayer(CONFIG.TILE_URL, {
		attribution: CONFIG.TILE_ATTRIBUTION,
		bounds: CONFIG.BOUNDS,
	}).addTo(map)

	CAMPUS_LANDMARKS.forEach((building) => {
		L.marker(building.coordinates, { icon: LANDMARK_ICON })
			.addTo(map)
			.bindPopup(buildLandmarkPopup(building))
	})

	const events = await fetchMapEvents()
	events.forEach((event) => {
		const coords = [Number(event.latitude), Number(event.longitude)]
		L.circle(coords, {
			radius: event.radius_meters,
			color: '#0c2461',
			fillColor: '#0c2461',
			fillOpacity: 0.08,
			weight: 1.5,
		}).addTo(map)
		L.marker(coords, { icon: EVENT_ICON })
			.addTo(map)
			.bindPopup(buildEventPopup(event))
	})

	console.log(
		`[map] Rendered ${CAMPUS_LANDMARKS.length} landmarks + ${events.length} events`
	)
}

document.addEventListener('DOMContentLoaded', initializeApp)
