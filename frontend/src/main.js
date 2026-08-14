/**
 * MAP CONFIGURATION CONSTANTS
 * Centered precisely on Wits Braamfontein Campus.
 */
const CONFIG = {
  CENTER_COORDINATES: [-26.1905, 28.0285], // Center adjusted slightly north
  DEFAULT_ZOOM: 16.5,
  MIN_ZOOM: 16, // Keeps users tightly framed within the campus boundary
  MAX_ZOOM: 19,
  // Adjusted bounding box: Bottom limit shifted up past Smit St (hides railways), Top limit extended north past Empire Rd
  BOUNDS: [
    [-26.1945, 28.0210], // South-West corner (Shifted North to chop off railways)
    [-26.1835, 28.0340], // North-East corner (Extended North to show more top area)
  ],
  TILE_URL: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  TILE_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
          },
          {
            id: 'bldg_002',
            name: 'Solomon Mahlangu House',
            campus: 'East Campus',
            category: 'Administration',
            description: '🏢 Main administrative concourse and student services.',
            coordinates: [-26.1932, 28.0305],
          },
          {
            id: 'bldg_003',
            name: 'Robert Sobukwe Block',
            campus: 'East Campus',
            category: 'Academic',
            description: '🏫 Major lecture halls and central academic facilities.',
            coordinates: [-26.1928, 28.0301],
          },
          {
            id: 'bldg_004',
            name: 'William Cullen Library',
            campus: 'East Campus',
            category: 'Library',
            description: '📚 Historic central library overlooking Library Lawns.',
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
            description: '🍔 Central student food court, shops, and social hub.',
            coordinates: [-26.1905, 28.0315],
          },
          {
            id: 'bldg_007',
            name: 'Umthombo Building',
            campus: 'East Campus',
            category: 'Academic & Labs',
            description: '💻 Major lecture theatre complex and central computer labs.',
            coordinates: [-26.1912, 28.0312],
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
          },
          {
            id: 'bldg_009',
            name: 'North West Engineering',
            campus: 'East Campus',
            category: 'Engineering Faculty',
            description: '⚙️ Mechanical & Aeronautical Engineering laboratories.',
            coordinates: [-26.1920, 28.0289],
          },
          {
            id: 'bldg_010',
            name: 'South West Engineering',
            campus: 'East Campus',
            category: 'Engineering Faculty',
            description: '⚡ Electrical, Information & Civil Engineering offices.',
            coordinates: [-26.1927, 28.0292],
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
          },
          {
            id: 'bldg_012',
            name: 'Humphrey Raikes Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🧪 School of Chemistry research facilities.',
            coordinates: [-26.1930, 28.0315],
          },
          {
            id: 'bldg_013',
            name: 'Oppenheimer Life Sciences Building',
            campus: 'East Campus',
            category: 'Science Faculty',
            description: '🔬 Biological & Environmental Sciences research complex.',
            coordinates: [-26.1922, 28.0320],
          },
          {
            id: 'bldg_014',
            name: 'Gate House',
            campus: 'East Campus',
            category: 'Administration & Entrance',
            description: '🚪 Main University Avenue entrance and visitor control.',
            coordinates: [-26.1931, 28.0322],
          },
          {
            id: 'bldg_015',
            name: 'Wits School of Arts (WSOA)',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎨 Fine Arts, Film, Television, and Music departments.',
            coordinates: [-26.1935, 28.0325],
          },
          {
            id: 'bldg_016',
            name: 'Chris Seabrooke Music Hall',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎶 Concert venue for Wits Music recitals & performances.',
            coordinates: [-26.1930, 28.0324],
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
            description: '⚽ Multipurpose sports stadium, former home of Bidvest Wits FC.',
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
            description: '🖼️ Public gallery housing Wits\' African art collection.',
            coordinates: [-26.1942, 28.0331],
          },
          {
            id: 'bldg_021',
            name: 'Wits Theatre',
            campus: 'East Campus',
            category: 'Arts & Media',
            description: '🎭 Main stage for Wits Theatre & Drama for Life productions.',
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
            description: '🪨 School of Geosciences labs and lecture venues.',
            coordinates: [-26.1932, 28.0315],
          },
          {
            id: 'bldg_024',
            name: 'Johannesburg Planetarium',
            campus: 'East Campus',
            category: 'Landmark',
            description: '🌌 Public planetarium and astronomy shows on East Campus.',
            coordinates: [-26.1895, 28.0310],
          },
          {
            id: 'bldg_025',
            name: 'Men\'s Residence (David Webster Hall East)',
            campus: 'East Campus',
            category: 'Student Residence',
            description: '🛏️ Traditional men\'s residence hall.',
            coordinates: [-26.1901, 28.0322],
          },
          {
            id: 'bldg_026',
            name: 'Jubilee Hall',
            campus: 'East Campus',
            category: 'Student Residence',
            description: '🛏️ Student residence near East Campus sports fields.',
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
            coordinates: [-26.1910, 28.0255],
          },
          {
            id: 'bldg_104',
            name: 'Science Stadium Auditoriums',
            campus: 'West Campus',
            category: 'Science',
            description: '🔬 Large lecture stadium complex for foundational sciences.',
            coordinates: [-26.1925, 28.0242],
          },
          {
            id: 'bldg_105',
            name: 'TW Kambule Mathematical Sciences',
            campus: 'West Campus',
            category: 'Mathematics',
            description: '📐 School of Mathematics & Computational Sciences.',
            coordinates: [-26.1926, 28.0252],
          },
          {
            id: 'bldg_106',
            name: 'Chamber of Mines Building',
            campus: 'West Campus',
            category: 'Engineering',
            description: '⛏️ Mining Engineering research labs and classrooms.',
            coordinates: [-26.1934, 28.0258],
          },
          {
            id: 'bldg_107',
            name: 'Commerce Library',
            campus: 'West Campus',
            category: 'Library',
            description: '📚 Dedicated library for Commerce, Law & Management students.',
            coordinates: [-26.1908, 28.0248],
          },
          {
            id: 'bldg_108',
            name: 'Law Clinic',
            campus: 'West Campus',
            category: 'Law Faculty',
            description: '⚖️ Free legal aid clinic run by Wits Law students.',
            coordinates: [-26.1906, 28.0246],
          },
          {
            id: 'bldg_109',
            name: 'CCDU (Counselling & Careers Development Unit)',
            campus: 'West Campus',
            category: 'Student Support',
            description: '🧠 Student counselling, wellness, and careers services.',
            coordinates: [-26.1928, 28.0256],
          },
          {
            id: 'bldg_110',
            name: 'Metro Bus Depot',
            campus: 'West Campus',
            category: 'Transport',
            description: '🚌 Campus shuttle & Metrobus stop for student transport.',
            coordinates: [-26.1920, 28.0232],
          },
          {
            id: 'bldg_111',
            name: 'West Campus Village',
            campus: 'West Campus',
            category: 'Student Residence',
            description: '🏘️ Large self-catering student residence complex.',
            coordinates: [-26.1888, 28.0235],
          },
          {
            id: 'bldg_112',
            name: 'Sturrock Park',
            campus: 'West Campus',
            category: 'Sports & Athletics',
            description: '🏈 Sports fields used for rugby, football & athletics.',
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
            description: '🛏️ Student residence overlooking Gavin Relly Green.',
            coordinates: [-26.1885, 28.0242],
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
 */
function buildPopupContent(buildingData) {
  return `
    <div class="event-popup">
      <h3>${buildingData.name}</h3>
      <p>${buildingData.description}</p>
      <span class="location-tag">${buildingData.campus} &bull; ${buildingData.category}</span>
    </div>
  `
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
 * MAP INITIALIZATION FUNCTION
 */
async function initializeApp() {
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

  const buildingsList = await fetchCampusEvents()

  buildingsList.forEach((building) => {
    const marker = L.marker(building.coordinates).addTo(map)

    const popupContent = buildPopupContent(building)
    marker.bindPopup(popupContent)

    if (building.name === 'Great Hall') {
      marker.openPopup()
    }
  })

  if (DEV_MODE) {
    attachCoordinatePicker(map)
  }
}

document.addEventListener('DOMContentLoaded', initializeApp)