/**
 * MAP CONFIGURATION CONSTANTS
 * Centered precisely on Wits Braamfontein Campus.
 */
const CONFIG = {
  CENTER_COORDINATES: [-26.1905, 28.0285], // Center adjusted slightly north
  DEFAULT_ZOOM: 16.5,
  MIN_ZOOM: 2, // Unrestricted: Allows users to zoom out globally
  MAX_ZOOM: 19,
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}

/**
 * AUTHENTICATION STATE (MOCK)
 * Set isLoggedIn to false to test visitor behavior, or true to test authenticated users.
 */
const AUTH_STATE = {
  isLoggedIn: false,
}

/**
 * DEV MODE — COORDINATE PICKER
 * Set DEV_MODE = true to click on the map and log exact coordinates to your console.
 */
const DEV_MODE = false

/**
 * DYNAMIC DATA FETCHING SERVICE
 * Comprehensive building dataset for Wits East & West Campus.
 */
async function fetchCampusEvents() {
  try {
    // -------------------------------------------------------------------------
    // TODO: When Node.js backend is running, swap with real endpoint:
    // const response = await fetch('/api/v1/buildings');
    // return await response.json();
    // -------------------------------------------------------------------------

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          /* ===================================================================
             EAST CAMPUS - CENTRAL & SOUTH QUAD
             =================================================================== */
          {
            id: 'bldg_001',
            name: 'Great Hall',
            campus: 'East Campus',
            category: 'Landmark',
            description: '🏛️ Central graduation hall & core architectural landmark.',
            coordinates: [-26.1925, 28.0305],
            hasChallenge: true,
          },
          {
            id: 'bldg_002',
            name: 'Solomon Mahlangu House',
            campus: 'East Campus',
            category: 'Administration',
            description: '🏢 Main administrative concourse and student services.',
            coordinates: [-26.1932, 28.0305],
            hasChallenge: false,
          },
          {
            id: 'bldg_003',
            name: 'Robert Sobukwe Block',
            campus: 'East Campus',
            category: 'Academic',
            description: '🏫 Major lecture halls and central academic facilities.',
            coordinates: [-26.1928, 28.0301],
            hasChallenge: false,
          },
          {
            id: 'bldg_004',
            name: 'William Cullen Library',
            campus: 'East Campus',
            category: 'Library',
            description: '📚 Historic central library overlooking Library Lawns.',
            coordinates: [-26.1918, 28.0298],
            hasChallenge: true,
          },
          {
            id: 'bldg_005',
            name: 'Wartenweiler Library',
            campus: 'East Campus',
            category: 'Library',
            description: '📖 Primary 24-hour undergraduate study library.',
            coordinates: [-26.1918, 28.0311],
            hasChallenge: false,
          },
          {
            id: 'bldg_006',
            name: 'The Matrix',
            campus: 'East Campus',
            category: 'Student Hub',
            description: '🍔 Central student food court, shops, and social hub.',
            coordinates: [-26.1905, 28.0315],
            hasChallenge: true,
          },
          {
            id: 'bldg_007',
            name: 'Umthombo Building',
            campus: 'East Campus',
            category: 'Academic & Labs',
            description: '💻 Major lecture theatre complex and central computer labs.',
            coordinates: [-26.1912, 28.0312],
            hasChallenge: false,
          },

          /* ===================================================================
             EAST CAMPUS - ENGINEERING & BUILT ENVIRONMENT
             =================================================================== */
          {
            id: 'bldg_008',
            name: 'John Moffat Building',
            campus: 'East Campus',
            category: 'Architecture & Design',
            description: '📐 School of Architecture, Planning, and Fine Arts.',
            coordinates: [-26.1910, 28.0291],
            hasChallenge: false,
          },
          {
            id: 'bldg_009',
            name: 'North West Engineering',
            campus: 'East Campus',
            category: 'Engineering Faculty',
            description: '⚙️ Mechanical & Aeronautical Engineering laboratories.',
            coordinates: [-26.1920, 28.0289],
            hasChallenge: false,
          },
          {
            id: 'bldg_010',
            name: 'South West Engineering',
            campus: 'East Campus',
            category: 'Engineering Faculty',
            description: '⚡ Electrical, Information & Civil Engineering offices.',
            coordinates: [-26.1927, 28.0292],
            hasChallenge: false,
          },

          /* ===================================================================
             EAST CAMPUS - SCIENCE & ARTS EAST WING
             =================================================================== */
          {
            id: 'bldg_011',
            name: 'Physics Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🔭 Department of Physics laboratories and lecture halls.',
            coordinates: [-26.1926, 28.0315],
            hasChallenge: true,
          },
          {
            id: 'bldg_012',
            name: 'Humphrey Raikes Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🧪 School of Chemistry research facilities.',
            coordinates: [-26.1930, 28.0315],
            hasChallenge: false,
          },
          {
            id: 'bldg_013',
            name: 'Oppenheimer Life Sciences Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🔬 Biological & Environmental Sciences research complex.',
            coordinates: [-26.1922, 28.0320],
            hasChallenge: false,
          },
          {
            id: 'bldg_014',
            name: 'Gate House',
            campus: 'East Campus',
            category: 'Administration & Entrance',
            description: '🚪 Main University Avenue entrance and visitor control.',
            coordinates: [-26.1931, 28.0322],
            hasChallenge: false,
          },
          {
            id: 'bldg_015',
            name: 'Wits School of Arts (WSOA)',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎨 Fine Arts, Film, Television, and Music departments.',
            coordinates: [-26.1935, 28.0325],
            hasChallenge: false,
          },
          {
            id: 'bldg_016',
            name: 'Chris Seabrooke Music Hall',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎶 Concert venue for Wits Music recitals & performances.',
            coordinates: [-26.1930, 28.0324],
            hasChallenge: false,
          },
          {
            id: 'bldg_017',
            name: 'Old Mutual Sports Hall',
            campus: 'East Campus',
            category: 'Sports & Athletics',
            description: '🏀 Wits Sport Multipurpose indoor sports arena.',
            coordinates: [-26.1902, 28.0294],
            hasChallenge: false,
          },
          {
            id: 'bldg_018',
            name: 'Bidvest Stadium',
            campus: 'East Campus',
            category: 'Sports & Athletics',
            description: '⚽ Multipurpose sports stadium, former home of Bidvest Wits FC.',
            coordinates: [-26.1882, 28.0287],
            hasChallenge: false,
          },
          {
            id: 'bldg_019',
            name: 'Origins Centre',
            campus: 'East Campus',
            category: 'Museum',
            description: '🦴 Museum of human origins and African rock art.',
            coordinates: [-26.1936, 28.0328],
            hasChallenge: true,
          },
          {
            id: 'bldg_020',
            name: 'Wits Art Museum (WAM)',
            campus: 'East Campus',
            category: 'Museum',
            description: '🖼️ Public gallery housing Wits\' African art collection.',
            coordinates: [-26.1942, 28.0331],
            hasChallenge: true,
          },
          {
            id: 'bldg_021',
            name: 'Wits Theatre',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎭 Main stage for Wits Theatre & Drama for Life productions.',
            coordinates: [-26.1938, 28.0326],
            hasChallenge: false,
          },
          {
            id: 'bldg_022',
            name: 'Bernard Price Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🌋 Geophysics and seismology research institute.',
            coordinates: [-26.1934, 28.0318],
            hasChallenge: false,
          },
          {
            id: 'bldg_023',
            name: 'Geosciences Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🪨 School of Geosciences labs and lecture venues.',
            coordinates: [-26.1932, 28.0315],
            hasChallenge: false,
          },
          {
            id: 'bldg_024',
            name: 'Johannesburg Planetarium',
            campus: 'East Campus',
            category: 'Landmark',
            description: '🌌 Public planetarium and astronomy shows on East Campus.',
            coordinates: [-26.1895, 28.0310],
            hasChallenge: true,
          },
          {
            id: 'bldg_025',
            name: 'Men\'s Residence (David Webster Hall East)',
            campus: 'East Campus',
            category: 'Student Residence',
            description: '🛏️ Traditional men\'s residence hall.',
            coordinates: [-26.1901, 28.0322],
            hasChallenge: false,
          },
          {
            id: 'bldg_026',
            name: 'Jubilee Hall',
            campus: 'East Campus',
            category: 'Student Residence',
            description: '🛏️ Student residence near East Campus sports fields.',
            coordinates: [-26.1896, 28.0318],
            hasChallenge: false,
          },
          {
            id: 'bldg_027',
            name: 'College House',
            campus: 'East Campus',
            category: 'Student Residence',
            description: '🛏️ Mixed student residence on East Campus.',
            coordinates: [-26.1892, 28.0321],
            hasChallenge: false,
          },

          /* ===================================================================
             WEST CAMPUS BUILDINGS
             =================================================================== */
          {
            id: 'bldg_101',
            name: 'FNB Building / School of Accountancy',
            campus: 'West Campus',
            category: 'Commerce',
            description: '📊 School of Accountancy & Finance auditoriums.',
            coordinates: [-26.1898, 28.0255],
            hasChallenge: false,
          },
          {
            id: 'bldg_102',
            name: 'Oliver Schreiner School of Law',
            campus: 'West Campus',
            category: 'Law Faculty',
            description: '⚖️ Law library, Chalsty Centre, and law courts.',
            coordinates: [-26.1904, 28.0248],
            hasChallenge: true,
          },
          {
            id: 'bldg_103',
            name: 'Wits Business Sciences',
            campus: 'West Campus',
            category: 'Commerce',
            description: '💼 School of Business Sciences & Economics.',
            coordinates: [-26.1910, 28.0255],
            hasChallenge: false,
          },
          {
            id: 'bldg_104',
            name: 'Science Stadium Auditoriums',
            campus: 'West Campus',
            category: 'Science',
            description: '🔬 Large lecture stadium complex for foundational sciences.',
            coordinates: [-26.1925, 28.0242],
            hasChallenge: true,
          },
          {
            id: 'bldg_105',
            name: 'TW Kambule Mathematical Sciences',
            campus: 'West Campus',
            category: 'Mathematics',
            description: '📐 School of Mathematics & Computational Sciences.',
            coordinates: [-26.1926, 28.0252],
            hasChallenge: false,
          },
          {
            id: 'bldg_106',
            name: 'Chamber of Mines Building',
            campus: 'West Campus',
            category: 'Engineering',
            description: '⛏️ Mining Engineering research labs and classrooms.',
            coordinates: [-26.1934, 28.0258],
            hasChallenge: false,
          },
          {
            id: 'bldg_107',
            name: 'Commerce Library',
            campus: 'West Campus',
            category: 'Library',
            description: '📚 Dedicated library for Commerce, Law & Management students.',
            coordinates: [-26.1908, 28.0248],
            hasChallenge: false,
          },
          {
            id: 'bldg_108',
            name: 'Law Clinic',
            campus: 'West Campus',
            category: 'Law Faculty',
            description: '⚖️ Free legal aid clinic run by Wits Law students.',
            coordinates: [-26.1906, 28.0246],
            hasChallenge: false,
          },
          {
            id: 'bldg_109',
            name: 'CCDU (Counselling & Careers Development Unit)',
            campus: 'West Campus',
            category: 'Student Support',
            description: '🧠 Student counselling, wellness, and careers services.',
            coordinates: [-26.1928, 28.0256],
            hasChallenge: false,
          },
          {
            id: 'bldg_110',
            name: 'Metro Bus Depot',
            campus: 'West Campus',
            category: 'Transport',
            description: '🚌 Campus shuttle & Metrobus stop for student transport.',
            coordinates: [-26.1920, 28.0232],
            hasChallenge: false,
          },
          {
            id: 'bldg_111',
            name: 'West Campus Village',
            campus: 'West Campus',
            category: 'Student Residence',
            description: '🏘️ Large self-catering student residence complex.',
            coordinates: [-26.1888, 28.0235],
            hasChallenge: false,
          },
          {
            id: 'bldg_112',
            name: 'Sturrock Park',
            campus: 'West Campus',
            category: 'Sports & Athletics',
            description: '🏈 Sports fields used for rugby, football & athletics.',
            coordinates: [-26.1945, 28.0215],
            hasChallenge: false,
          },
          {
            id: 'bldg_113',
            name: 'David Webster Hall',
            campus: 'West Campus',
            category: 'Student Residence',
            description: '🛏️ West Campus student residence.',
            coordinates: [-26.1888, 28.0252],
            hasChallenge: false,
          },
          {
            id: 'bldg_114',
            name: 'Barnato Hall',
            campus: 'West Campus',
            category: 'Student Residence',
            description: '🛏️ Student residence overlooking Gavin Relly Green.',
            coordinates: [-26.1885, 28.0242],
            hasChallenge: false,
          },
        ])
      }, 100)
    })
  } catch (error) {
    console.error('Error loading campus buildings data:', error)
    return []
  }
}

/**
 * POPUP TEMPLATE BUILDER
 * Generates card content & appends the challenge button handler.
 */
function buildPopupContent(buildingData) {
  const challengeButtonHtml = buildingData.hasChallenge
    ? `<button class="challenge-btn" style="margin-top: 10px; padding: 6px 12px; background: #0c2461; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
    : `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`

  return `
    <div class="event-popup">
      <h3>${buildingData.name}</h3>
      <p>${buildingData.description}</p>
      <span class="location-tag">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div class="popup-actions">
        ${challengeButtonHtml}
      </div>
    </div>
  `
}

/**
 * CHALLENGE ATTEMPT INTERCEPTOR
 * Invoked when clicking an "Attempt Challenge" button inside a marker popup.
 */
window.handleChallengeAttempt = function (buildingId) {
  if (AUTH_STATE.isLoggedIn) {
    // Registered User: proceeds directly
    sessionStorage.removeItem('pending_challenge_id')
    alert(`🎯 Starting Challenge for location ID: ${buildingId}!`)
  } else {
    // Visitor: Saves targeted location and prompts redirect to authentication
    sessionStorage.setItem('pending_challenge_id', buildingId)
    alert(`🔒 Login Required!\n\nRedirecting to login page...\n(Saved targeted challenge '${buildingId}' to session state)`)
    
    // Uncomment once your teammates merge the real auth route:
    // window.location.href = '/login.html';
  }
}

/**
 * RESUME CHALLENGE CHECK
 * Auto-detects saved challenge session state after logging in.
 */
function checkPendingChallenge(markersMap) {
  const pendingChallengeId = sessionStorage.getItem('pending_challenge_id')

  if (pendingChallengeId && AUTH_STATE.isLoggedIn) {
    console.log(`[Auth Resume] Auto-opening pending challenge: ${pendingChallengeId}`)
    
    // Locate marker and open its popup directly on start
    const targetMarker = markersMap.get(pendingChallengeId)
    if (targetMarker) {
      targetMarker.openPopup()
    }

    alert(`🎉 Welcome back! Resuming your saved challenge for building ID: ${pendingChallengeId}`)
    sessionStorage.removeItem('pending_challenge_id')
  }
}

/**
 * DEV TOOL: attaches a click listener that logs & copies clicked coordinates.
 */
function attachCoordinatePicker(map) {
  let pickerMarker = null

  map.on('click', (e) => {
    const { lat, lng } = e.latlng
    const rounded = [Number(lat.toFixed(5)), Number(lng.toFixed(5))]
    const snippet = `[${rounded[0]}, ${rounded[1]}],`

    if (pickerMarker) {
      map.removeLayer(pickerMarker)
    }
    pickerMarker = L.marker(rounded, {
      icon: L.divIcon({
        className: 'coord-picker-marker',
        html: '📍',
        iconSize: [24, 24],
      }),
    })
      .addTo(map)
      .bindPopup(`<code>${snippet}</code>`)
      .openPopup()

    console.log('[coord-picker]', snippet)

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(snippet).catch(() => {})
    }
  })

  console.info(
    '%c[DEV_MODE] Coordinate picker active — click the map to log & copy [lat, lng] pairs.',
    'color:#0c2461;font-weight:bold;'
  )
}

/**
 * MAP INITIALIZATION FUNCTION (UNRESTRICTED)
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
  const markersMap = new Map()

  buildingsList.forEach((building) => {
    const marker = L.marker(building.coordinates).addTo(map)
    const popupContent = buildPopupContent(building)
    marker.bindPopup(popupContent)

    markersMap.set(building.id, marker)

    if (building.name === 'Great Hall' && !sessionStorage.getItem('pending_challenge_id')) {
      marker.openPopup()
    }
  })

  // Evaluates whether a logged-in user is returning to attempt a previously selected challenge
  checkPendingChallenge(markersMap)

  if (DEV_MODE) {
    attachCoordinatePicker(map)
  }
}

document.addEventListener('DOMContentLoaded', initializeApp)