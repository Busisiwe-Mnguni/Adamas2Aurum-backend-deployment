/**
 * MAP CONFIGURATION CONSTANTS
 */
const CONFIG = {
  CENTER_COORDINATES: [-26.1905, 28.0285],
  DEFAULT_ZOOM: 16.5,
  MIN_ZOOM: 2,
  MAX_ZOOM: 18,
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

const API_BASE = 'http://localhost:3000/api'

// Tracks the currently logged-in user (null if not authenticated).
// Set by checkAuthSession(); read by handleChallengeAttempt() to gate access.
let currentUser = null

/**
 * CUSTOM LEAFLET PIN ICONS
 */
const buildingIcon = L.divIcon({
  className: 'custom-building-pin',
  html: `
    <div style="
      background-color: #0c2461;
      width: 32px;
      height: 32px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid #ffffff;
      box-shadow: 0 3px 6px rgba(0,0,0,0.4);
    ">
      <span style="transform: rotate(45deg); font-size: 16px;">🏛️</span>
    </div>
  `,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
})

const playerIcon = L.divIcon({
  className: 'custom-player-pin',
  html: `
    <div style="position: relative; width: 36px; height: 36px;">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background-color: rgba(231, 76, 60, 0.4);
        animation: pulse-ring 1.8s infinite ease-out;
      "></div>
      <div style="
        background-color: #e74c3c;
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 8px rgba(0,0,0,0.4);
        position: absolute;
        top: 2px;
        left: 2px;
      ">
        <span style="transform: rotate(45deg); font-size: 16px;">📍</span>
      </div>
    </div>
    <style>
      @keyframes pulse-ring {
        0% { transform: scale(0.8); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    </style>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
})

/**
 * DYNAMIC DATA FETCHING SERVICE (BACKEND INTEGRATED)
 */
async function fetchCampusEvents() {
  try {
    const res = await fetch(`${API_BASE}/events`)
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

    const dbEvents = await res.json()

    if (Array.isArray(dbEvents) && dbEvents.length > 0) {
      return dbEvents.map((event) => ({
        id: event.event_id,
        name: event.title,
        campus: event.campus || 'Wits Campus',
        category: event.category || 'General',
        description: event.description || '',
        coordinates: [parseFloat(event.latitude), parseFloat(event.longitude)],
        hasChallenge: event.point_reward > 0 || event.hasChallenge,
      }))
    }
  } catch (err) {
    console.warn('Backend API connection failed, falling back to static locations:', err)
  }

  return [
    { id: 1, name: 'Great Hall', campus: 'East Campus', category: 'Landmark', description: '🏛️ Central graduation hall & core architectural landmark.', coordinates: [-26.1925, 28.0305], hasChallenge: true },
    { id: 2, name: 'Solomon Mahlangu House', campus: 'East Campus', category: 'Administration', description: '🏢 Main administrative concourse and student services.', coordinates: [-26.1932, 28.0305], hasChallenge: false },
    { id: 3, name: 'Robert Sobukwe Block', campus: 'East Campus', category: 'Academic', description: '🏫 Major lecture halls and central academic facilities.', coordinates: [-26.1928, 28.0301], hasChallenge: false },
    { id: 4, name: 'William Cullen Library', campus: 'East Campus', category: 'Library', description: '📚 Historic central library overlooking Library Lawns.', coordinates: [-26.1918, 28.0298], hasChallenge: true },
    { id: 5, name: 'Wartenweiler Library', campus: 'East Campus', category: 'Library', description: '📖 Primary 24-hour undergraduate study library.', coordinates: [-26.1918, 28.0311], hasChallenge: false },
    { id: 6, name: 'The Matrix', campus: 'East Campus', category: 'Student Hub', description: '🍔 Central student food court, shops, and social hub.', coordinates: [-26.1905, 28.0315], hasChallenge: true },
  ]
}

/**
 * POPUP TEMPLATE BUILDER
 */
function buildPopupContent(buildingData) {
  const challengeButtonHtml = buildingData.hasChallenge
    ? `<button class="challenge-btn" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
    : `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`

  return `
    <div class="event-popup">
      <h3>${buildingData.name}</h3>
      <p style="margin: 6px 0;">${buildingData.description}</p>
      <span style="font-size: 0.8rem; background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div>
        ${challengeButtonHtml}
      </div>
    </div>
  `
}

/**
 * CHALLENGE ATTEMPT INTERCEPTOR & TRIVIA MODAL
 * Gated on auth: unauthenticated users are redirected to the login/register
 * page instead of being able to fetch or attempt a challenge.
 */
window.handleChallengeAttempt = async function (eventId) {
  if (!currentUser) {
    // Preserve where the player was headed so auth.html can send them back
    window.location.href = `/pages/auth.html?redirect=${encodeURIComponent(window.location.pathname)}`
    return
  }

  try {
    const res = await fetch(`${API_BASE}/trivia/event/${eventId}`, {
      credentials: 'include',
    })
    if (!res.ok) {
      if (res.status === 401) {
        // Session expired/invalidated server-side since page load
        window.location.href = `/pages/auth.html?redirect=${encodeURIComponent(window.location.pathname)}`
        return
      }
      alert('No trivia challenges available for this location right now!')
      return
    }

    const trivia = await res.json()
    showTriviaModal(eventId, trivia)
  } catch (err) {
    alert('Error connecting to challenge server.')
  }
}

function showTriviaModal(eventId, trivia) {
  let modal = document.getElementById('trivia-modal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'trivia-modal'
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `
    document.body.appendChild(modal)
  }

  const optionsHtml = trivia.options.map(opt => `
    <button style="display: block; width: 100%; margin: 8px 0; padding: 10px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;"
            onclick="submitTriviaAnswer(${eventId}, ${trivia.question_id}, ${opt.option_id})">
      ${opt.body}
    </button>
  `).join('')

  modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 8px; max-width: 400px; width: 90%;">
      <h3>🎯 Campus Challenge</h3>
      <p style="margin: 12px 0;"><strong>${trivia.body}</strong></p>
      <div>${optionsHtml}</div>
      <button style="margin-top: 12px; background: none; border: none; color: #888; cursor: pointer; text-decoration: underline;"
              onclick="document.getElementById('trivia-modal').remove()">Close</button>
    </div>
  `
}

window.submitTriviaAnswer = async function (eventId, questionId, optionId) {
  try {
    const res = await fetch(`${API_BASE}/trivia/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        event_id: eventId,
        question_id: questionId,
        selected_option_id: optionId,
        answer_time_ms: 1500
      })
    })

    if (res.status === 401) {
      alert('Your session has expired. Please log in again.')
      window.location.href = `/pages/auth.html?redirect=${encodeURIComponent(window.location.pathname)}`
      return
    }

    const data = await res.json()
    alert(data.message)
    const modal = document.getElementById('trivia-modal')
    if (modal) modal.remove()
  } catch (err) {
    alert('Failed to submit answer. Ensure you are signed in.')
  }
}

/**
 * PLAYER GEOLOCATION TRACKER
 */
function setupPlayerGeolocation(map) {
  let playerMarker = null

  function updatePosition(position) {
    const { latitude, longitude } = position.coords
    const latLng = [latitude, longitude]

    if (!playerMarker) {
      playerMarker = L.marker(latLng, { icon: playerIcon })
        .addTo(map)
        .bindPopup('📍 You are here!')
    } else {
      playerMarker.setLatLng(latLng)
    }
  }

  if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(updatePosition, (err) => console.warn(err.message), {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    })
  }
}

/**
 * AUTH SESSION TRACKER
 * Populates `currentUser` so the rest of the app (challenge gating, etc.)
 * knows whether a player is logged in.
 */
async function checkAuthSession() {
  const container = document.getElementById('auth-nav-container')
  if (!container) return

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      credentials: 'include',
    })

    if (res.ok) {
      const user = await res.json()
      currentUser = user
      container.innerHTML = `
        <div class="user-badge">
          <span>👤 ${user.name}</span>
          <button id="logout-btn" class="logout-btn">Log Out</button>
        </div>
      `
      document.getElementById('logout-btn').addEventListener('click', handleLogout)
    } else {
      currentUser = null
      container.innerHTML = `<a href="/pages/auth.html" class="auth-link">Sign In / Register</a>`
    }
  } catch (err) {
    currentUser = null
    container.innerHTML = `<a href="/pages/auth.html" class="auth-link">Sign In / Register</a>`
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })
    window.location.reload()
  } catch (err) {
    console.error('Logout error:', err)
  }
}

/**
 * MAP INITIALIZATION FUNCTION
 */
async function initializeApp() {
  const map = L.map('map', {
    center: CONFIG.CENTER_COORDINATES,
    zoom: CONFIG.DEFAULT_ZOOM,
    minZoom: CONFIG.MIN_ZOOM,
    maxZoom: CONFIG.MAX_ZOOM,
    maxNativeZoom: 18,
  })

  L.tileLayer(CONFIG.TILE_URL, {
    attribution: CONFIG.TILE_ATTRIBUTION,
    maxZoom: 19,
    maxNativeZoom: 18,
  }).addTo(map)

  // Auth state must be known before markers are added, since popups
  // decide whether "Attempt Challenge" is gated based on currentUser.
  await checkAuthSession()

  const buildingsList = await fetchCampusEvents()

  buildingsList.forEach((building) => {
    const marker = L.marker(building.coordinates, { icon: buildingIcon }).addTo(map)
    marker.bindPopup(buildPopupContent(building))
  })

  setupPlayerGeolocation(map)
}

document.addEventListener('DOMContentLoaded', initializeApp)