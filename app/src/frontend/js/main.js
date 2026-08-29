import { emailSignIn, emailSignUp, googleSignIn, baSignOut, clearBridgeSession } from './auth-client.js';
import { get_player_location } from './geolocation.js';

const API_BASE = '/api';
let currentUser = null;
let map = null;
let playerMarker = null;

// Exact Center of Wits East Campus (Great Hall area)
const WITS_EAST_CAMPUS = [28.0305, -26.1928];
let playerCoords = [...WITS_EAST_CAMPUS]; 
const STEP_SIZE = 0.00008; // WASD step distance

/**
 * ACCURATE WITS BRAAMFONTEIN CAMPUS BUILDINGS
 */
async function fetchCampusEvents() {
  try {
    const res = await fetch(`${API_BASE}/events`);
    if (res.ok) {
      const dbEvents = await res.json();
      if (Array.isArray(dbEvents) && dbEvents.length > 0) {
        return dbEvents.map((event) => ({
          id: event.event_id,
          name: event.title,
          campus: event.campus || 'Wits Campus',
          category: event.category || 'General',
          description: event.description || '',
          coordinates: [parseFloat(event.longitude), parseFloat(event.latitude)],
          hasChallenge: event.point_reward > 0 || event.hasChallenge,
        }));
      }
    }
  } catch (err) {
    console.warn('Backend API offline, loading verified Wits Campus markers:', err);
  }

  // Verified Wits Braamfontein East & West Campus Pin Coordinates
  return [
    { id: 1, name: 'Great Hall', campus: 'East Campus', category: 'Landmark', description: '🏛️ Main iconic graduation hall & steps.', coordinates: [28.0305, -26.1928], hasChallenge: true },
    { id: 2, name: 'Solomon Mahlangu House', campus: 'East Campus', category: 'Administration', description: '🏢 Main admin & senate building.', coordinates: [28.0312, -26.1932], hasChallenge: true },
    { id: 3, name: 'William Cullen Library', campus: 'East Campus', category: 'Library', description: '📚 Central historic library.', coordinates: [28.0301, -26.1916], hasChallenge: true },
    { id: 4, name: 'Wits Art Museum (WAM)', campus: 'East Campus', category: 'Museum', description: '🎨 Art gallery on Jan Smuts Ave.', coordinates: [28.0332, -26.1935], hasChallenge: false },
    { id: 5, name: 'Umthombo Building', campus: 'East Campus', category: 'Academic', description: '📖 Major lecture hall complex.', coordinates: [28.0315, -26.1908], hasChallenge: true },
    { id: 6, name: 'The Matrix', campus: 'West Campus', category: 'Student Hub', description: '🍔 Main student center & food court.', coordinates: [28.0256, -26.1902], hasChallenge: true },
    { id: 7, name: 'FNB Building', campus: 'West Campus', category: 'Academic', description: '📊 School of Accountancy & Commerce.', coordinates: [28.0250, -26.1888], hasChallenge: false },
    { id: 8, name: 'Commerce Library', campus: 'West Campus', category: 'Library', description: '📖 Law & commerce research library.', coordinates: [28.0248, -26.1908], hasChallenge: true },
    { id: 9, name: 'Science Stadium', campus: 'West Campus', category: 'Academic', description: '🔬 Large science lecture auditoriums.', coordinates: [28.0242, -26.1925], hasChallenge: true },
    { id: 10, name: 'Chamber of Mines', campus: 'West Campus', category: 'Engineering', description: '⛏️ Faculty of Engineering building.', coordinates: [28.0262, -26.1920], hasChallenge: false }
  ];
}

function buildPopupContent(buildingData) {
  const challengeButtonHtml = buildingData.hasChallenge
    ? `<button style="background:#2ecc71; color:white; border:none; padding:8px 12px; border-radius:6px; margin-top:8px; width:100%; font-weight:bold; cursor:pointer;" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
    : `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`;

  return `
    <div style="padding: 4px; min-width: 180px;">
      <h3 style="margin: 0 0 4px 0; color: #0c2461; font-size: 1rem;">${buildingData.name}</h3>
      <p style="margin: 4px 0; font-size: 0.85rem; color: #333;">${buildingData.description}</p>
      <span style="font-size: 0.75rem; background: #f1f2f6; color: #2c3e50; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div>${challengeButtonHtml}</div>
    </div>
  `;
}

function createBuildingPinElement(building) {
  const el = document.createElement('div');
  el.className = 'pokego-building-pin';
  el.innerHTML = `
    <div class="gem-icon ${building.hasChallenge ? 'challenge' : ''}">
      ${building.hasChallenge ? '⚡' : '🏛️'}
    </div>
    <div class="pin-label">${building.name}</div>
  `;
  return el;
}

/**
 * AVATAR & MOVEMENT SETUP
 */
function setupPlayerAvatar(coords) {
  playerCoords = coords;

  const el = document.createElement('div');
  el.className = 'player-location-pin';
  el.style.cssText = 'transition: transform 0.1s linear; cursor: pointer;';
  el.innerHTML = `
    <div class="player-pulse-ring"></div>
    <div class="player-avatar-icon" style="font-size: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));">🏃</div>
  `;

  if (playerMarker) playerMarker.remove();

  playerMarker = new maplibregl.Marker({ element: el })
    .setLngLat(playerCoords)
    .addTo(map);

  // Zoom directly into Wits campus view
  map.flyTo({
    center: playerCoords,
    zoom: 18,
    pitch: 50,
    duration: 1000
  });

  setupMovementControls();
}

function setupMovementControls() {
  window.addEventListener('keydown', (e) => {
    if (!playerCoords) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    let deltaLng = 0;
    let deltaLat = 0;

    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': deltaLat = STEP_SIZE; break;
      case 's': case 'arrowdown': deltaLat = -STEP_SIZE; break;
      case 'a': case 'arrowleft': deltaLng = -STEP_SIZE; break;
      case 'd': case 'arrowright': deltaLng = STEP_SIZE; break;
      default: return;
    }

    e.preventDefault();
    playerCoords = [playerCoords[0] + deltaLng, playerCoords[1] + deltaLat];
    playerMarker.setLngLat(playerCoords);

    map.easeTo({ center: playerCoords, duration: 100 });
  });
}

/**
 * GEOLOCATION INITIALIZER
 */
function initUserPosition() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setupPlayerAvatar([pos.coords.longitude, pos.coords.latitude]);
      },
      () => {
        // Fallback directly to Wits Great Hall if location is off or denied
        setupPlayerAvatar(WITS_EAST_CAMPUS);
      },
      { enableHighAccuracy: true }
    );
  } else {
    setupPlayerAvatar(WITS_EAST_CAMPUS);
  }
}

/**
 * AUTHENTICATION SESSION CHECK
 */
async function checkAuthSession() {
  const container = document.getElementById('auth-nav-container');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/me`, { method: 'GET', credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      currentUser = user;
      container.innerHTML = `<div class="user-badge"><span>👤 ${user.name}</span><button id="logout-btn" class="logout-btn">Log Out</button></div>`;
      document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await baSignOut();
        await clearBridgeSession();
        window.location.reload();
      });
    } else {
      currentUser = null;
      container.innerHTML = `<button onclick="openAuthDrawer()" class="auth-link">Sign In / Register</button>`;
    }
  } catch (err) {
    currentUser = null;
  }
}

/**
 * TRIVIA HANDLER
 */
window.handleChallengeAttempt = async function (eventId) {
  if (!currentUser) {
    openAuthDrawer();
    return;
  }

  const [lat, lng] = [playerCoords[1], playerCoords[0]];

  try {
    const res = await fetch(`${API_BASE}/trivia/event/${eventId}?lat=${lat}&lng=${lng}`, { credentials: 'include' });
    if (res.status === 401) return openAuthDrawer();
    if (res.status === 403) {
      const data = await res.json();
      alert(`Too far! You are ${data.distance_meters}m away (need < ${data.radius_meters}m). Walk closer using WASD/Arrow keys!`);
      return;
    }
    if (!res.ok) return alert('No active trivia available right now.');

    const trivia = await res.json();
    showTriviaModal(eventId, trivia);
  } catch (err) {
    alert('Error connecting to challenge server.');
  }
};

function showTriviaModal(eventId, trivia) {
  let modal = document.getElementById('trivia-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'trivia-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;`;
    document.body.appendChild(modal);
  }

  const optionsHtml = trivia.options.map(opt => `
    <button style="display: block; width: 100%; margin: 8px 0; padding: 10px; border-radius: 6px; border: 1px solid #ccc; cursor: pointer;"
            onclick="submitTriviaAnswer(${eventId}, ${trivia.question_id}, ${opt.option_id})">
      ${opt.body}
    </button>
  `).join('');

  modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%;">
      <h3>🎯 Wits Campus Challenge</h3>
      <p style="margin: 12px 0;"><strong>${trivia.body}</strong></p>
      <div id="trivia-options">${optionsHtml}</div>
      <div id="trivia-result" style="margin-top: 12px;"></div>
      <button style="margin-top: 12px; background: none; border: none; color: #888; cursor: pointer;" onclick="document.getElementById('trivia-modal').remove()">Close</button>
    </div>
  `;
}

window.submitTriviaAnswer = async function (eventId, questionId, optionId) {
  const [lat, lng] = [playerCoords[1], playerCoords[0]];

  try {
    const res = await fetch(`${API_BASE}/trivia/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ event_id: eventId, question_id: questionId, selected_option_id: optionId, claimed_lat: lat, claimed_lng: lng })
    });

    const data = await res.json();
    const resultContainer = document.getElementById('trivia-result');
    if (resultContainer) {
      resultContainer.innerHTML = data.is_correct && data.location_verified
        ? `<p style="color: #27ae60; font-weight: bold;">✅ Correct! +${data.points_awarded} points</p>`
        : `<p style="color: #c0392b; font-weight: bold;">❌ Challenge Failed.</p>`;
    }
  } catch (err) {
    alert('Failed to submit answer.');
  }
};

/**
 * INITIALIZE WITS MAP ENGINE
 */
async function initializeApp() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: WITS_EAST_CAMPUS,
    zoom: 18,
    pitch: 50
  });

  map.on('load', async () => {
    // 1. Spawn player at GPS position or fallback to Great Hall
    initUserPosition();

    // 2. Render Wits Campus Pins
    try {
      const buildings = await fetchCampusEvents();
      buildings.forEach((bld) => {
        const pinElement = createBuildingPinElement(bld);
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(buildPopupContent(bld));

        new maplibregl.Marker({ element: pinElement })
          .setLngLat(bld.coordinates)
          .setPopup(popup)
          .addTo(map);
      });
    } catch (err) {
      console.error('Building pin error:', err);
    }

    // 3. Silent auth check
    await checkAuthSession().catch(() => {});

    // 4. Connect Recenter Button to player
    document.getElementById('recenter-btn')?.addEventListener('click', () => {
      map.flyTo({
        center: playerCoords,
        zoom: 18,
        pitch: 50,
        duration: 1000
      });
    });
  });
}

window.openAuthDrawer = () => {
  document.getElementById('auth-overlay')?.classList.add('open');
  document.getElementById('auth-drawer')?.classList.add('open');
};

window.closeAuthDrawer = () => {
  document.getElementById('auth-overlay')?.classList.remove('open');
  document.getElementById('auth-drawer')?.classList.remove('open');
};

document.addEventListener('DOMContentLoaded', initializeApp);