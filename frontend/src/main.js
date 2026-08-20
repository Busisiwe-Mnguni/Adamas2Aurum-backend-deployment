/**
 * MAP CONFIGURATION CONSTANTS
 */
const CONFIG = {
  CENTER_COORDINATES: [-26.1905, 28.0285],
  DEFAULT_ZOOM: 16.5,
  MIN_ZOOM: 2,
  MAX_ZOOM: 19,
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

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
 * DYNAMIC DATA FETCHING SERVICE
 */
async function fetchCampusEvents() {
  return [
    { id: 'bldg_001', name: 'Great Hall', campus: 'East Campus', category: 'Landmark', description: '🏛️ Central graduation hall & core architectural landmark.', coordinates: [-26.1925, 28.0305], hasChallenge: true },
    { id: 'bldg_002', name: 'Solomon Mahlangu House', campus: 'East Campus', category: 'Administration', description: '🏢 Main administrative concourse and student services.', coordinates: [-26.1932, 28.0305], hasChallenge: false },
    { id: 'bldg_003', name: 'Robert Sobukwe Block', campus: 'East Campus', category: 'Academic', description: '🏫 Major lecture halls and central academic facilities.', coordinates: [-26.1928, 28.0301], hasChallenge: false },
    { id: 'bldg_004', name: 'William Cullen Library', campus: 'East Campus', category: 'Library', description: '📚 Historic central library overlooking Library Lawns.', coordinates: [-26.1918, 28.0298], hasChallenge: true },
    { id: 'bldg_005', name: 'Wartenweiler Library', campus: 'East Campus', category: 'Library', description: '📖 Primary 24-hour undergraduate study library.', coordinates: [-26.1918, 28.0311], hasChallenge: false },
    { id: 'bldg_006', name: 'The Matrix', campus: 'East Campus', category: 'Student Hub', description: '🍔 Central student food court, shops, and social hub.', coordinates: [-26.1905, 28.0315], hasChallenge: true },
    { id: 'bldg_007', name: 'Umthombo Building', campus: 'East Campus', category: 'Academic & Labs', description: '💻 Major lecture theatre complex and central computer labs.', coordinates: [-26.1912, 28.0312], hasChallenge: false },
    { id: 'bldg_101', name: 'FNB Building / School of Accountancy', campus: 'West Campus', category: 'Commerce', description: '📊 School of Accountancy & Finance auditoriums.', coordinates: [-26.1898, 28.0255], hasChallenge: false },
    { id: 'bldg_102', name: 'Oliver Schreiner School of Law', campus: 'West Campus', category: 'Law Faculty', description: '⚖️ Law library, Chalsty Centre, and law courts.', coordinates: [-26.1904, 28.0248], hasChallenge: true },
    { id: 'bldg_104', name: 'Science Stadium Auditoriums', campus: 'West Campus', category: 'Science', description: '🔬 Large lecture stadium complex for foundational sciences.', coordinates: [-26.1925, 28.0242], hasChallenge: true },
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
 * CHALLENGE ATTEMPT INTERCEPTOR
 */
window.handleChallengeAttempt = function (buildingId) {
  alert(`🎯 Starting Challenge for location ID: ${buildingId}!`)
}

/**
 * PLAYER GEOLOCATION TRACKER
 */
function setupPlayerGeolocation(map) {
  let playerMarker = null
  let accuracyCircle = null
  let hasCenteredOnPlayer = false

  function updatePosition(position) {
    const { latitude, longitude, accuracy } = position.coords
    const latLng = [latitude, longitude]

    if (!playerMarker) {
      playerMarker = L.marker(latLng, { icon: playerIcon })
        .addTo(map)
        .bindPopup('📍 You are here!')

      accuracyCircle = L.circle(latLng, {
        radius: accuracy,
        color: '#e74c3c',
        fillColor: '#e74c3c',
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map)
    } else {
      playerMarker.setLatLng(latLng)
      accuracyCircle.setLatLng(latLng)
      accuracyCircle.setRadius(accuracy)
    }

    if (!hasCenteredOnPlayer) {
      map.setView(latLng, CONFIG.DEFAULT_ZOOM)
      hasCenteredOnPlayer = true
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
 * MAP INITIALIZATION FUNCTION
 */
async function initializeApp() {
  const map = L.map('map', {
    center: CONFIG.CENTER_COORDINATES,
    zoom: CONFIG.DEFAULT_ZOOM,
    minZoom: CONFIG.MIN_ZOOM,
    maxZoom: CONFIG.MAX_ZOOM,
  })

  L.tileLayer(CONFIG.TILE_URL, {
    attribution: CONFIG.TILE_ATTRIBUTION,
  }).addTo(map)

  const buildingsList = await fetchCampusEvents()

  buildingsList.forEach((building) => {
    const marker = L.marker(building.coordinates, { icon: buildingIcon }).addTo(map)
    marker.bindPopup(buildPopupContent(building))
  })

  setupPlayerGeolocation(map)
}

document.addEventListener('DOMContentLoaded', initializeApp)