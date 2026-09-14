<<<<<<< HEAD
/**
 * Better Auth client functions for the auth drawer.
 * These wrap the Better Auth browser client (loaded via auth-client.bundle.mjs).
 */

import { API_BASE } from "./constants.js";
import {
    usernameSignIn,
    usernameSignUp,
    googleSignIn,
    baSignOut,
    clearBridgeSession,
} from "./auth-client.js";
import { redirectAfterLogin, updateAuthNav } from "./auth-helpers.js";
import { get_player_location } from "./geolocation.js";

/**
 * MAP CONFIGURATION CONSTANTS
 */
const CONFIG = {
    CENTER_COORDINATES: [-26.1905, 28.0285], // roughly Wits East Campus — where the map centers on load
    DEFAULT_ZOOM: 16.5,
    MIN_ZOOM: 2,
    MAX_ZOOM: 18,
    TILE_URL: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", // free OSM map tiles, no API key needed
    TILE_ATTRIBUTION:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

// Tracks the currently logged-in user (null if not authenticated). This is
// set once, in checkAuthSession(), and then read anywhere in this file
// that needs to know "is someone logged in right now" — e.g.
// handleChallengeAttempt() below uses it to decide whether to open the
// auth drawer instead of opening a challenge.
let currentUser = null;
let mapInstance = null;
let mapMarkers = [];
=======
import {
	usernameSignIn,
	usernameSignUp,
	googleSignIn,
	baSignOut,
	clearBridgeSession,
} from './auth-client.js'
import { API_BASE } from './constants.js'
import { get_player_location } from './geolocation.js'
import { suggestEventOrder } from './graph.js'
import { redirectAfterLogin, updateAuthNav, logout } from './auth-helpers.js'
import {
	createCampusStyle,
	CAMPUS_CAMERA,
	CAMPUS_HOME,
	CAMPUS_MIN_ZOOM,
	CAMPUS_MAX_ZOOM,
	CAMPUS_MIN_PITCH,
	CAMPUS_MAX_PITCH,
	isInsideCampus,
	addGroundTexture,
	startDayNightCycle,
} from './campus-style.js'

let currentUser = null
let map = null
let playerMarker = null
let playerDotEl = null
let playerAccuracyEl = null

const originalGeolocationGetPos = navigator?.geolocation?.getCurrentPosition
let playerCoords = [...CAMPUS_HOME]
let playerAccuracyMeters = 0
let followMode = true
let demoMode = true // true until a real GPS fix arrives
let watchId = null
let lastInside = null // last geofence state: true/false/null (unknown)

// Avatar motion state: heading in degrees (0 = north), walk/idle visual,
// and a short trail of fading breadcrumb dots.
let playerHeading = 0
let lastMoveAt = 0
let walkTimer = null
let lastCrumbAt = null
const crumbs = []
const MAX_CRUMBS = 20

// Tracked stop markers for proximity glow + radius circles.
const stopMarkers = []
let pullbackTimer = null
const STEP_SIZE = 0.00008 // WASD step distance

// Dev-test simulated fixes (same coordinates as the v4 preview).
const SIM_ON_CAMPUS = [28.0345, -26.1875]
const SIM_OFF_CAMPUS = [28.0567, -26.1076] // e.g. Sandton — well outside

// ── Trivia result rendering helpers ───────────────────────────
const RARITY_STYLE = {
	COMMON: { bg: '#e5e7eb', fg: '#1f2937', label: 'Common' },
	UNCOMMON: { bg: '#bbf7d0', fg: '#14532d', label: 'Uncommon' },
	RARE: { bg: '#bfdbfe', fg: '#1e3a8a', label: 'Rare' },
	EPIC: { bg: '#e9d5ff', fg: '#581c87', label: 'Epic' },
	LEGENDARY: { bg: '#fde68a', fg: '#78350f', label: 'Legendary' },
}
function rarityBadge(rarity) {
	const s = RARITY_STYLE[rarity] || RARITY_STYLE.COMMON
	return `<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:600;letter-spacing:0.5px;background:${s.bg};color:${s.fg};text-transform:uppercase;">${s.label}</span>`
}
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

// Handle to the running trivia countdown, so a reuse of the modal for a
// new question clears any prior interval.
let activeTriviaTimer = null
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

/*
 * Completed events tracking
 */
<<<<<<< HEAD
const buildingIcon = L.divIcon({
    className: "custom-building-pin",
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
    iconAnchor: [16, 32], // bottom-center of the icon points at the actual coordinate
    popupAnchor: [0, -32], // popup opens above the pin, not on top of it
});

const playerIcon = L.divIcon({
    className: "custom-player-pin",
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
});
=======
const COMPLETED_EVENTS_KEY = 'wits-quest:completed-events'

function loadCompletedEventIds() {
	try {
		const raw = localStorage.getItem(COMPLETED_EVENTS_KEY)
		return new Set(raw ? JSON.parse(raw) : [])
	} catch {
		return new Set()
	}
}

const completedEventIds = loadCompletedEventIds()

function isEventCompleted(eventId) {
	return completedEventIds.has(String(eventId))
}

function markEventCompleted(eventId) {
	completedEventIds.add(String(eventId))
	try {
		localStorage.setItem(
			COMPLETED_EVENTS_KEY,
			JSON.stringify([...completedEventIds])
		)
	} catch {
		// localStorage unavailable
	}
}

/*
 * Suggested route
 */
let suggestedOrder = []
let nextSuggestedEventId = null

function refreshNextSuggested() {
	const nextUp = suggestedOrder.find(
		(ev) => !isEventCompleted(ev.event_id)
	)
	nextSuggestedEventId = nextUp ? String(nextUp.event_id) : null
	applyNextSuggestedMarker()
}

function applyNextSuggestedMarker() {
	for (const stop of stopMarkers) {
		stop.pinEl.classList.toggle(
			'next-suggested',
			nextSuggestedEventId !== null &&
				String(stop.id) === nextSuggestedEventId
		)
	}
}

let lastFlownNextSuggestedId = null

function flyToNextSuggested() {
	if (!map || nextSuggestedEventId === null) return
	if (nextSuggestedEventId === lastFlownNextSuggestedId) return

	const stop = suggestedOrder.find(
		(ev) => String(ev.event_id) === nextSuggestedEventId
	)
	if (!stop) return
	const lng = parseFloat(stop.longitude)
	const lat = parseFloat(stop.latitude)
	if (!Number.isFinite(lng) || !Number.isFinite(lat)) return

	lastFlownNextSuggestedId = nextSuggestedEventId
	followMode = false
	setStatusChip('demo', 'Showing next stop — 🎯 to follow GPS')
	map.flyTo({
		center: [lng, lat],
		zoom: Math.max(map.getZoom(), 17.5),
		pitch: 60,
		duration: 1200,
	})
}
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10

/**
 * ACCURATE WITS BRAAMFONTEIN CAMPUS BUILDINGS
 */

// ---------------------------------------------------------------------------
// OFFLINE ATTEMPT QUEUE
//
// When a player answers a challenge but has no signal, we don't want to lose
// the attempt — a dead zone on campus shouldn't stop them from playing. So
// instead of failing, the attempt (answer + timestamp + location fix + ids)
// is written to localStorage. It sits there until syncOfflineAttempts()
// replays it against /api/trivia/submit, which runs automatically whenever
// the browser fires 'online', and once on page load. The queue survives
// page reloads and app restarts.
// ---------------------------------------------------------------------------

const OFFLINE_QUEUE_KEY = "adamas.offlineAttempts.v1";

function getOfflineQueue() {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn("Could not read offline queue:", err);
        return [];
    }
}

function saveOfflineQueue(queue) {
    try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
        console.warn("Could not write offline queue:", err);
    }
}

function queueOfflineAttempt(attempt) {
    const queue = getOfflineQueue();
    queue.push(attempt);
    saveOfflineQueue(queue);
    updateOfflineBanner();
}

/**
 * Paints the small status bar under the header. Called after every queue
 * mutation and on network state change, so the player always sees an
 * honest picture of what is / isn't synced.
 */
function updateOfflineBanner() {
    const banner = document.getElementById("offline-banner");
    if (!banner) return;

    const pending = getOfflineQueue().length;
    const online = navigator.onLine;

    if (!pending && online) {
        banner.classList.remove("visible");
        banner.textContent = "";
        return;
    }

    const s = pending === 1 ? "" : "s";
    if (!online && pending) {
        banner.textContent = `Offline — ${pending} attempt${s} saved, will sync when you're back online.`;
    } else if (!online) {
        banner.textContent = ` You're offline — your next attempt will be saved on this device.`;
    } else {
        banner.textContent = ` ${pending} saved attempt${s} waiting to sync…`;
    }
    banner.classList.add("visible");
}

/**
 * Replays every queued attempt against the server. Called on page load and
 * on the window 'online' event.
 *
 * Drop rules:
 *   - 2xx, 4xx → server saw it (even a rejection like 403 out-of-range
 *     counts as "processed"), so remove from queue.
 *   - 401      → session gone; keep queued, a future login can retry.
 *   - 5xx or network error → keep queued, we'll try again later.
 */
async function syncOfflineAttempts() {
    if (!navigator.onLine) {
        updateOfflineBanner();
        return;
    }

    const queue = getOfflineQueue();
    if (!queue.length) {
        updateOfflineBanner();
        return;
    }

    const remaining = [];
    for (const attempt of queue) {
        try {
            const res = await fetch(`${API_BASE}/api/trivia/submit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                credentials: "include",
                body: JSON.stringify({
                    event_id: attempt.event_id,
                    question_id: attempt.question_id,
                    selected_option_id: attempt.selected_option_id,
                    answer_time_ms: attempt.answer_time_ms,
                    claimed_lat: attempt.claimed_lat,
                    claimed_lng: attempt.claimed_lng,
                    client_timestamp: attempt.timestamp,
                }),
            });

            if (res.status === 401 || res.status >= 500) {
                remaining.push(attempt);
            }
        } catch (err) {
            // Still no network — stop and keep this one.
            remaining.push(attempt);
        }
    }

    saveOfflineQueue(remaining);
    updateOfflineBanner();
}
async function fetchCampusEvents() {
<<<<<<< HEAD
    try {
        const res = await fetch(`${API_BASE}/api/events`, {
            cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

        const dbEvents = await res.json();

        if (Array.isArray(dbEvents) && dbEvents.length > 0) {
            // Reshape the DB's column names into what the rest of this file
            // expects (e.g. latitude/longitude → a single coordinates array
            // Leaflet can use directly).
            return dbEvents.map((event) => ({
                id: event.event_id,
                name: event.title,
                campus: event.campus || "Wits Campus",
                category: event.category || "General",
                description: event.description || "",
                coordinates: [
                    parseFloat(event.latitude),
                    parseFloat(event.longitude),
                ],
                hasChallenge: event.point_reward > 0 || event.hasChallenge,
            }));
        }
    } catch (err) {
        console.warn(
            "Backend API connection failed, falling back to static locations:",
            err,
        );
    }

    // Fallback data — only used if the fetch above throws or returns empty.
    return [
        {
            id: 1,
            name: "Great Hall",
            campus: "East Campus",
            category: "Landmark",
            description:
                "🏛️ Central graduation hall & core architectural landmark.",
            coordinates: [-26.1925, 28.0305],
            hasChallenge: true,
        },
        {
            id: 2,
            name: "Solomon Mahlangu House",
            campus: "East Campus",
            category: "Administration",
            description:
                "🏢 Main administrative concourse and student services.",
            coordinates: [-26.1932, 28.0305],
            hasChallenge: false,
        },
        {
            id: 3,
            name: "Robert Sobukwe Block",
            campus: "East Campus",
            category: "Academic",
            description:
                "🏫 Major lecture halls and central academic facilities.",
            coordinates: [-26.1928, 28.0301],
            hasChallenge: false,
        },
        {
            id: 4,
            name: "William Cullen Library",
            campus: "East Campus",
            category: "Library",
            description:
                "📚 Historic central library overlooking Library Lawns.",
            coordinates: [-26.1918, 28.0298],
            hasChallenge: true,
        },
        {
            id: 5,
            name: "Wartenweiler Library",
            campus: "East Campus",
            category: "Library",
            description: "📖 Primary 24-hour undergraduate study library.",
            coordinates: [-26.1918, 28.0311],
            hasChallenge: false,
        },
        {
            id: 6,
            name: "The Matrix",
            campus: "East Campus",
            category: "Student Hub",
            description:
                "🍔 Central student food court, shops, and social hub.",
            coordinates: [-26.1905, 28.0315],
            hasChallenge: true,
        },
    ];
=======
	try {
		const res = await fetch(`${API_BASE}/api/events`, {
			cache: 'no-store',
		})
		if (!res.ok) return []
		const dbEvents = await res.json()
		const coords = await get_player_location() // returns [latitude, longitude]
		const loc = {
			latitude: coords[0],
			longitude: coords[1],
		}
		const { order } = suggestEventOrder(dbEvents, loc)
		suggestedOrder = order
		refreshNextSuggested()
		if (Array.isArray(dbEvents) && dbEvents.length > 0) {
			return dbEvents
				.map((event) => ({
					id: event.event_id,
					name: event.title,
					campus: event.campus || 'Wits Campus',
					category: event.category || 'General',
					description: event.description || '',
					coordinates: [
						parseFloat(event.longitude),
						parseFloat(event.latitude),
					],
					radius_meters: event.radius_meters,
					hasChallenge:
						event.point_reward > 0 ||
						event.hasChallenge,
				}))
				.filter(
					(bld) =>
						Number.isFinite(
							bld.coordinates[0]
						) &&
						Number.isFinite(
							bld.coordinates[1]
						)
				)
		}
	} catch (err) {
		console.warn('Backend API offline, no events to show:', err)
	}

	// No hardcoded fallback stops: markers come only from events
	// created in the admin console (via the backend API above).
	return []
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
}

function buildPopupContent(buildingData) {
<<<<<<< HEAD
    const challengeButtonHtml = buildingData.hasChallenge
        ? `<button class="challenge-btn" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
        : `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`;

    return `
    <div class="event-popup">
      <h3>${buildingData.name}</h3>
      <p style="margin: 6px 0;">${buildingData.description}</p>
      <span style="font-size: 0.8rem; background: #e0e0e0; padding: 2px 6px; border-radius: 3px;">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div>
        ${challengeButtonHtml}
      </div>
=======
	const challengeButtonHtml = buildingData.hasChallenge
		? `<button style="background:#2ecc71; color:white; border:none; padding:8px 12px; border-radius:6px; margin-top:8px; width:100%; font-weight:bold; cursor:pointer;" onclick="handleChallengeAttempt('${buildingData.id}')">⚡ Attempt Challenge</button>`
		: `<p style="margin-top: 8px; font-size: 0.85rem; color: #666;">No active challenge here.</p>`

	return `
    <div style="padding: 4px; min-width: 180px;">
      <h3 style="margin: 0 0 4px 0; color: #0c2461; font-size: 1rem;">${buildingData.name}</h3>
      <p style="margin: 4px 0; font-size: 0.85rem; color: #333;">${buildingData.description}</p>
      <span style="font-size: 0.75rem; background: #f1f2f6; color: #2c3e50; padding: 2px 6px; border-radius: 4px; font-weight: bold;">${buildingData.campus} &bull; ${buildingData.category}</span>
      <div>${challengeButtonHtml}</div>
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
    </div>
  `;
}

<<<<<<< HEAD
/**
 * CHALLENGE ATTEMPT INTERCEPTOR & TRIVIA MODAL
 *
 * Attached to `window` (not a plain function) because it's called from an
 * inline onclick="" attribute in HTML generated above — inline handlers
 * can only reach globally-scoped functions, not ones defined with a plain
 * `function` keyword inside a module.
 *
 * This is the auth gate: if nobody's logged in, open the auth drawer
 * instead of letting them see or answer a question at all.
 *
 * LOCATION CHECK (new): before fetching the question, this now calls
 * get_player_location() (from geolocation.js) to get the player's current
 * GPS coordinates, then sends them as ?lat=..&lng=.. query params. The
 * backend (routes/trivia.js) uses these to check the player is actually
 * within the event's radius_meters before releasing the question —
 * satisfying user story 7's "when I open a challenge I'm at" wording.
 */
window.handleChallengeAttempt = async function (eventId) {
    if (!currentUser) {
        // Open the auth drawer instead of navigating away from the map
        openAuthDrawer();
        return;
    }

    // Ask the browser for the player's current position. This will prompt
    // for location permission the first time — if the player denies it, or
    // their device doesn't support geolocation, get_player_location()
    // rejects and we stop here with a clear message rather than silently
    // failing or letting them through unverified.
    let coords;
    try {
        coords = await get_player_location(); // returns [latitude, longitude]
    } catch (err) {
        alert(
            `Couldn't get your location: ${err.message}. Location access is required to attempt a challenge.`,
        );
        return;
    }
    const [lat, lng] = coords;

    try {
        const res = await fetch(
            `${API_BASE}/api/trivia/event/${eventId}?lat=${lat}&lng=${lng}`,
            {
                credentials: "include", // sends the session cookie along, so the backend's requireAuth check can identify who's asking
            },
        );

        if (res.status === 401) {
            // Session cookie expired or was invalidated server-side between
            // page load and clicking this button — open auth drawer.
            openAuthDrawer();
            return;
        }

        if (res.status === 403) {
            // Location check failed server-side — player is outside the
            // event's radius. Show them how far off they are.
            const data = await res.json();
            alert(
                `You're too far from this location to attempt the challenge. ` +
                    `You're about ${data.distance_meters}m away (need to be within ${data.radius_meters}m).`,
            );
            return;
        }

        if (!res.ok) {
            alert(
                "No trivia challenges available for this location right now!",
            );
            return;
        }

        const trivia = await res.json();
        showTriviaModal(eventId, trivia);
    } catch (err) {
        alert("Error connecting to challenge server.");
    }
};

/**
 * Renders the actual quiz popup: the question text, one button per
 * answer option, and two empty containers (#trivia-options,
 * #trivia-result) that submitTriviaAnswer() below fills in once the
 * player picks an answer.
 */
function showTriviaModal(eventId, trivia) {
    let modal = document.getElementById("trivia-modal");
    if (!modal) {
        // Reuse the same modal element across multiple challenge attempts
        // instead of creating a new one every time.
        modal = document.createElement("div");
        modal.id = "trivia-modal";
        modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `;
        document.body.appendChild(modal);
    }

    // Each button's onclick bakes in the eventId, question_id, and this
    // specific option's option_id — that's all submitTriviaAnswer() needs
    // to tell the server which question and which choice was picked.
    const optionsHtml = trivia.options
        .map(
            (opt) => `
    <button style="display: block; width: 100%; margin: 8px 0; padding: 10px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;"
            onclick="submitTriviaAnswer(${eventId}, ${trivia.question_id}, ${opt.option_id})">
      ${opt.body}
    </button>
  `,
        )
        .join("");

    // User story 8 — if the player has ALREADY earned this event's card,
    // show a clear banner BEFORE they answer. Don't silently let them redo
    // the challenge and then quietly withhold the card — that looks like a
    // bug. They can still replay for practice, but it's visually obvious
    // no card is coming.
    const elig = trivia.card_eligibility;
    const earnedCardName = elig?.earned_card?.name;
    const alreadyEarnedBanner = elig?.already_earned
        ? `<div style="margin: 8px 0 12px; padding: 10px 12px; background: #fff8e1; border: 1px solid #ffd54f; border-left: 4px solid #ffb300; border-radius: 6px; color: #7a5c00; font-size: 0.85rem;">
         🎓 You've already earned ${earnedCardName ? `the <strong>${earnedCardName}</strong> ` : ""}card for this challenge — replay for practice? No new card will be awarded.
       </div>`
        : "";

    modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 8px; max-width: 400px; width: 90%;">
      <h3>🎯 Campus Challenge</h3>
      ${alreadyEarnedBanner}
      <p style="margin: 12px 0;"><strong>${trivia.body}</strong></p>
      <div id="trivia-options">${optionsHtml}</div>
      <div id="trivia-result" style="margin-top: 12px;"></div>
      <button style="margin-top: 12px; background: none; border: none; color: #888; cursor: pointer; text-decoration: underline;"
              onclick="document.getElementById('trivia-modal').remove()">Close</button>
    </div>
  `;
}

/**
 * Fires when the player clicks one of the answer buttons. This function
 * does NOT decide whether the answer is correct — it just sends the pick
 * to the server and displays whatever the server decides.
 *
 * LOCATION CHECK (new): fetches the player's location FRESH at submit
 * time (not reused from when the question was opened) — if someone opened
 * a challenge while standing at the location, then wandered off before
 * answering, this catches that too. The backend uses claimed_lat/
 * claimed_lng to compute the real distance and store it in
 * location_check_log, and only awards points if the location check
 * passes (see routes/trivia.js STEP 5).
 *
 * User story 7: reveals the correct answer afterward, whether the player
 * got it right or wrong, using correct_option_text from the server's
 * response.
 */
window.submitTriviaAnswer = async function (eventId, questionId, optionId) {
    const optionsContainer = document.getElementById("trivia-options");
    const resultContainer = document.getElementById("trivia-result");

    // Disable all answer buttons immediately so the player can't click a
    // second option while the first request is still in flight (which
    // would otherwise let them submit multiple answers to one question).
    if (optionsContainer) {
        optionsContainer
            .querySelectorAll("button")
            .forEach((btn) => (btn.disabled = true));
    }

    // Get a fresh location fix for this submission specifically.
    let lat = null;
    let lng = null;
    try {
        [lat, lng] = await get_player_location();
    } catch (err) {
        // Don't block the submission entirely if location fails here — the
        // backend will still grade correctness, it just won't be able to
        // verify location (and so won't award points). Surface this clearly
        // rather than silently losing the points.
        if (resultContainer) {
            resultContainer.innerHTML = `<p style="color: #c0392b;">Couldn't confirm your location (${err.message}) — your answer will be graded but points may not be awarded.</p>`;
        }
    }

    try {
        const res = await fetch(`${API_BASE}/api/trivia/submit`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // same reason as above — the backend needs the session cookie to know who's submitting
            body: JSON.stringify({
                event_id: eventId,
                question_id: questionId,
                selected_option_id: optionId,
                answer_time_ms: 1500, // TODO: currently hardcoded; a real implementation would time from when the modal opened
                claimed_lat: lat,
                claimed_lng: lng,
            }),
        });

        if (res.status === 401) {
            alert("Your session has expired. Please log in again.");
            openAuthDrawer();
            return;
        }

        const data = await res.json();

        if (!res.ok) {
            // e.g. a 404 "Invalid option selected" from the backend
            if (resultContainer) {
                resultContainer.innerHTML = `<p style="color: #c0392b;">${data.error || "Something went wrong submitting your answer."}</p>`;
            }
            return;
        }

        if (resultContainer) {
            // Green for correct-and-verified, red for anything else (wrong
            // answer, OR correct but too far away — location_verified === false
            // means no points either way, so both cases read as "not a win").
            const succeeded = data.is_correct && data.location_verified;
            const verdictColor = succeeded ? "#27ae60" : "#c0392b";
            const verdictText = succeeded
                ? `✅ Correct! +${data.points_awarded} points`
                : data.location_verified === false
                  ? `📍 Too far away — this attempt didn't count.`
                  : `❌ Not quite.`;

            // correct_option_text will be null only if a question was seeded
            // without any option marked is_correct — guard against that so we
            // don't render "Correct answer: null".
            const correctAnswerHtml = data.correct_option_text
                ? `<p style="margin-top: 6px; color: #333;">Correct answer: <strong>${data.correct_option_text}</strong></p>`
                : "";

            // User story 8 — show the card outcome explicitly. A retry after a
            // win must read as intended behaviour ("you've already earned this
            // card"), not a silent missing reward.
            let cardHtml = "";
            if (data.card_awarded && data.awarded_card) {
                const rarity = data.awarded_card.rarity
                    ? ` (${data.awarded_card.rarity})`
                    : "";
                cardHtml = `<p style="margin-top: 6px; color: #7a5c00; font-weight: bold;">🎉 New card earned: ${data.awarded_card.name}${rarity}!</p>`;
            } else if (succeeded && data.already_earned_card) {
                cardHtml = `<p style="margin-top: 6px; color: #888; font-size: 0.85rem;">You've already earned this card — no new card this time.</p>`;
            }

            resultContainer.innerHTML = `
        <p style="color: ${verdictColor}; font-weight: bold;">${verdictText}</p>
        ${cardHtml}
        ${correctAnswerHtml}
      `;
        }
    } catch (err) {
        // Network failure, backend down, etc. — this is exactly the "dead
        // zone on campus" case. Queue the attempt on the device instead of
        // losing it, and be honest with the player about its state.
        queueOfflineAttempt({
            event_id: eventId,
            question_id: questionId,
            selected_option_id: optionId,
            answer_time_ms: 1500,
            claimed_lat: lat,
            claimed_lng: lng,
            timestamp: new Date().toISOString(),
        });
        if (resultContainer) {
            resultContainer.innerHTML = `
        <p style="color: #b8860b; font-weight: bold;"> Saved on this device — we'll sync when you're back online.</p>
        <p style="color: #666; font-size: 0.8rem; margin-top: 4px;">Your answer and location fix are queued; nothing is lost.</p>
      `;
        }
    }
};

/**
 * PLAYER GEOLOCATION TRACKER
 * Uses the browser's Geolocation API to show the player's live position
 * on the map with a pulsing red marker. watchPosition (not getCurrentPosition)
 * keeps updating the marker as the player physically moves around campus.
 *
 * Note: this is separate from get_player_location() in geolocation.js,
 * which is used above for one-off position fixes (challenge open/submit).
 * This one continuously tracks position for the visual marker only.
 */
function setupPlayerGeolocation(map) {
    let playerMarker = null;

    function updatePosition(position) {
        const { latitude, longitude } = position.coords;
        const latLng = [latitude, longitude];

        if (!playerMarker) {
            // First position fix: create the marker.
            playerMarker = L.marker(latLng, { icon: playerIcon })
                .addTo(map)
                .bindPopup("📍 You are here!");
        } else {
            // Subsequent fixes: just move the existing marker instead of
            // creating a new one each time (which would leave duplicates).
            playerMarker.setLatLng(latLng);
        }
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
            updatePosition,
            (err) => console.warn(err.message),
            {
                enableHighAccuracy: true, // prefer GPS over coarse wifi/IP-based location
                maximumAge: 10000, // accept a cached position up to 10s old
                timeout: 10000, // give up waiting for a fix after 10s
            },
        );
    }
=======
function createBuildingPinElement(building) {
	const el = document.createElement('div')
	el.className = `pokestop ${building.hasChallenge ? 'gym' : ''}`
	el.title = building.name
	// PokéStop structure: floating cube on a slim pole over a ground ring.
	// .pokestop-bob carries the JS proximity scale; inner parts animate
	// independently via CSS.
	el.innerHTML = `<div class="pokestop-bob"><div class="stop-cube"><span>${building.hasChallenge ? '⚡' : '◈'}</span></div><div class="stop-pole"></div><div class="stop-ring"></div></div>`
	return el
}

// Approx meters between two [lng, lat] pairs (equirectangular — plenty for
// sub-kilometer game distances).
function distanceMeters(a, b) {
	const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
	const dx = (a[0] - b[0]) * kx
	const dy = (a[1] - b[1]) * 110540
	return Math.hypot(dx, dy)
}

function bearingBetween(a, b) {
	const kx = 111320 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180)
	const dx = (b[0] - a[0]) * kx
	const dy = (b[1] - a[1]) * 110540
	return (Math.atan2(dx, dy) * 180) / Math.PI
}

function setHeading(deg) {
	playerHeading = ((deg % 360) + 360) % 360
	const wedge = playerDotEl?.querySelector('.pogo-wedge')
	if (wedge) wedge.style.transform = `rotate(${playerHeading}deg)`
}

function setWalking(on) {
	const dot = playerDotEl?.querySelector('.pogo-dot')
	if (!dot) return
	dot.classList.toggle('walking', on)
	dot.classList.toggle('idle', !on)
	if (on) {
		lastMoveAt = Date.now()
		clearTimeout(walkTimer)
		walkTimer = setTimeout(() => setWalking(false), 2500)
	}
}

function dropCrumb(lng, lat) {
	if (lastCrumbAt && distanceMeters(lastCrumbAt, [lng, lat]) < 10) return
	lastCrumbAt = [lng, lat]
	const el = document.createElement('div')
	el.className = 'crumb'
	const marker = new maplibregl.Marker({ element: el })
		.setLngLat([lng, lat])
		.addTo(map)
	crumbs.push(marker)
	while (crumbs.length > MAX_CRUMBS) crumbs.shift().remove()
	setTimeout(() => {
		const i = crumbs.indexOf(marker)
		if (i >= 0) crumbs.splice(i, 1)
		marker.remove()
	}, 25000)
}

// Scale/glow each stop by live proximity (full glow inside ~40m, fading to
// baseline past ~250m). Applied to the INNER bob element — MapLibre owns
// the outer marker element's transform for positioning, so touching it
// would teleport the pin.
function refreshStopGlow() {
	for (const { el, lng, lat } of stopMarkers) {
		const d = distanceMeters(playerCoords, [lng, lat])
		const t = Math.max(0, Math.min(1, 1 - (d - 40) / 210))
		el.style.transform = `scale(${(1 + 0.4 * t).toFixed(3)})`
		el.style.setProperty('--pg', t.toFixed(3))
	}
}

// Translucent trigger-radius discs under each stop (event.radius_meters,
// 60m fallback) — transparency + gameplay in one visual.
function renderProximityCircles(stops) {
	if (!map) return
	const features = stops
		.filter((s) => Array.isArray(s.coordinates))
		.map((s) => ({
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'Polygon',
				coordinates: [
					circleCoords(
						s.coordinates[0],
						s.coordinates[1],
						s.radius_meters || 60
					),
				],
			},
		}))
	if (map.getSource('event-radii')) {
		// Refresh data on repeat renders so edited/new events update.
		map.getSource('event-radii').setData({
			type: 'FeatureCollection',
			features,
		})
		return
	}
	if (!features.length) return
	map.addSource('event-radii', {
		type: 'geojson',
		data: { type: 'FeatureCollection', features },
	})
	map.addLayer({
		id: 'event-radii-fill',
		type: 'fill',
		source: 'event-radii',
		paint: {
			'fill-color': '#2F9DF0',
			'fill-opacity': 0.1,
		},
	})
	map.addLayer({
		id: 'event-radii-line',
		type: 'line',
		source: 'event-radii',
		paint: {
			'line-color': '#2F9DF0',
			'line-width': 1.5,
			'line-opacity': 0.35,
			'line-dasharray': [4, 3],
		},
	})
}

function circleCoords(lng, lat, radiusMeters, steps = 48) {
	const pts = []
	const kx = 111320 * Math.cos((lat * Math.PI) / 180)
	for (let i = 0; i <= steps; i++) {
		const a = (i / steps) * Math.PI * 2
		pts.push([
			lng + (Math.cos(a) * radiusMeters) / kx,
			lat + (Math.sin(a) * radiusMeters) / 110540,
		])
	}
	return pts
}

// ---- Off-campus ambient fact stops ("wild flavor", not quests) ----
// Sourced live from the already-loaded vector tiles (poi layer), so this
// works anywhere in the world with zero extra data pipeline. Only named
// POIs qualify — plain buildings get nothing, keeping density PoGO-sparse.
// Visuals stay deliberately lower-stakes: tiny static "i" dots, no pulse,
// no radius. Tapping shows tile facts only — no minigame, no card.
// (Tile fields are a subset of OSM tags, so deeper qualification like
// wikipedia/wikidata lookups is deferred; see report.)
const factMarkers = []
const MAX_FACT_STOPS = 12
const FACT_MIN_ZOOM = 15.5

function clearFactStops() {
	for (const m of factMarkers) m.remove()
	factMarkers.length = 0
}

function humanizeKind(v) {
	return String(v || '')
		.replace(/_/g, ' ')
		.trim()
}

function refreshFactStops() {
	if (!map) return
	// Quest markers rule on campus — ambient flavor is off-campus only.
	if (
		isInsideCampus(playerCoords[0], playerCoords[1]) ||
		map.getZoom() < FACT_MIN_ZOOM
	) {
		clearFactStops()
		return
	}
	let feats = []
	try {
		feats = map.querySourceFeatures('carto', {
			sourceLayer: 'poi',
			filter: ['has', 'name'],
		})
	} catch {
		return
	}
	const bounds = map.getBounds()
	const center = map.getCenter().toArray()
	const seen = new Set()
	const scored = []
	for (const f of feats) {
		const name = f.properties?.name
		const g = f.geometry
		if (!name || !g || g.type !== 'Point') continue
		const [lng, lat] = g.coordinates
		if (
			lng < bounds.getWest() ||
			lng > bounds.getEast() ||
			lat < bounds.getSouth() ||
			lat > bounds.getNorth()
		)
			continue
		const key = `${name}|${lng.toFixed(4)},${lat.toFixed(4)}`
		if (seen.has(key)) continue
		seen.add(key)
		scored.push({
			lng,
			lat,
			name,
			kind: f.properties.class,
			d: distanceMeters([lng, lat], center),
		})
	}
	scored.sort((a, b) => a.d - b.d)
	clearFactStops()
	for (const s of scored.slice(0, MAX_FACT_STOPS)) {
		const el = document.createElement('div')
		el.className = 'fact-dot'
		el.title = s.name
		el.textContent = 'i'
		const popup = new maplibregl.Popup({
			offset: 12,
		}).setHTML(
			`<div class="fact-card"><h3>${escapeHtml(s.name)}</h3>` +
				(s.kind
					? `<p class="fact-kind">${escapeHtml(humanizeKind(s.kind))}</p>`
					: '') +
				`<p class="fact-note">🚏 Off-campus flavor stop — explore, no challenge here.</p></div>`
		)
		factMarkers.push(
			new maplibregl.Marker({ element: el })
				.setLngLat([s.lng, s.lat])
				.setPopup(popup)
				.addTo(map)
		)
	}
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
}

// Compass fallback for facing: GPS bearing wins while moving; otherwise
// ease toward the device compass where the browser exposes one. (iOS
// requires a user-gesture permission prompt for motion data, so this stays
// best-effort — no permission flow is triggered here.)
function setupOrientation() {
	const handler = (e) => {
		if (Date.now() - lastMoveAt < 4000) return
		let heading = null
		if (typeof e.webkitCompassHeading === 'number') {
			heading = e.webkitCompassHeading
		} else if (
			typeof e.alpha === 'number' &&
			e.absolute !== false
		) {
			heading = 360 - e.alpha
		}
		if (heading !== null && Number.isFinite(heading)) {
			setHeading(heading)
		}
	}
	window.addEventListener('deviceorientationabsolute', handler, true)
	window.addEventListener('deviceorientation', handler, true)
}

// Soft camera pull-back toward campus after 25s idle far away. Only arms
// when free-looking (never while following GPS) and fires only if the
// camera is still outside the campus bbox when the timer lapses.
const PULLBACK_IDLE_MS = 25000

function clearPullback() {
	if (pullbackTimer) {
		clearTimeout(pullbackTimer)
		pullbackTimer = null
	}
}

function armPullback() {
	clearPullback()
	if (!map || followMode || document.hidden) return
	const c = map.getCenter()
	if (isInsideCampus(c.lng, c.lat)) return
	pullbackTimer = setTimeout(() => {
		pullbackTimer = null
		if (!map || followMode || document.hidden) return
		const now = map.getCenter()
		if (!isInsideCampus(now.lng, now.lat)) {
			map.easeTo({ ...CAMPUS_CAMERA, duration: 1200 })
		}
	}, PULLBACK_IDLE_MS)
}

/**
 * PLAYER DOT — Pokémon-GO blue dot + accuracy circle, with follow mode.
 */
function setStatusChip(mode, text) {
	const chip = document.getElementById('gps-status')
	if (!chip) return
	chip.dataset.mode = mode
	chip.querySelector('.gps-text').textContent = text
}

function metersPerPixel(lat, zoom) {
	return (
		(156543.03392 * Math.cos((lat * Math.PI) / 180)) /
		Math.pow(2, zoom)
	)
}

function updateAccuracyCircle() {
	if (!playerAccuracyEl || !map) return
	const px = playerAccuracyMeters
		? Math.min(
				220,
				Math.max(
					18,
					(playerAccuracyMeters /
						metersPerPixel(
							playerCoords[1],
							map.getZoom()
						)) *
						2
				)
			)
		: 44
	playerAccuracyEl.style.width = `${px}px`
	playerAccuracyEl.style.height = `${px}px`
}

function ensurePlayerMarker() {
	if (playerMarker) return
	const el = document.createElement('div')
	el.className = 'pogo-player'
	el.innerHTML = `<div class="pogo-accuracy"></div><div class="pogo-wedge"></div><div class="pogo-dot idle"></div>`
	playerDotEl = el
	playerAccuracyEl = el.querySelector('.pogo-accuracy')
	playerMarker = new maplibregl.Marker({ element: el })
		.setLngLat(playerCoords)
		.addTo(map)
	updateAccuracyCircle()
	setHeading(playerHeading)
}

function movePlayerTo([lng, lat], { center = false, accuracy = 0 } = {}) {
	const prev = [...playerCoords]
	playerCoords = [lng, lat]
	if (accuracy > 0) playerAccuracyMeters = accuracy
	ensurePlayerMarker()
	playerMarker.setLngLat(playerCoords)
	updateAccuracyCircle()
	const moved = distanceMeters(prev, playerCoords)
	if (moved > 2) {
		setHeading(bearingBetween(prev, playerCoords))
		setWalking(true)
		dropCrumb(lng, lat)
		refreshStopGlow()
	}
	if (center) {
		map.easeTo({ center: playerCoords, duration: 400 })
	}
}

function setupMovementControls() {
	window.addEventListener('keydown', (e) => {
		if (!playerCoords) return
		if (
			['INPUT', 'TEXTAREA'].includes(
				document.activeElement.tagName
			)
		)
			return

		let deltaLng = 0
		let deltaLat = 0

		switch (e.key.toLowerCase()) {
			case 'w':
			case 'arrowup':
				deltaLat = STEP_SIZE
				break
			case 's':
			case 'arrowdown':
				deltaLat = -STEP_SIZE
				break
			case 'a':
			case 'arrowleft':
				deltaLng = -STEP_SIZE
				break
			case 'd':
			case 'arrowright':
				deltaLng = STEP_SIZE
				break
			default:
				return
		}

		e.preventDefault()
		// Keyboard walk = manual explore anywhere in the world: pause GPS
		// follow until recenter. Challenges stay campus-gated on tap.
		followMode = false
		setStatusChip('demo', 'Manual explore — 🎯 to follow GPS')
		movePlayerTo(
			[
				playerCoords[0] + deltaLng,
				playerCoords[1] + deltaLat,
			],
			{ center: true }
		)
	})
}

/**
 * GEOLOCATION — continuous watch (not one-shot), so the dot is actually live.
 */
function setBannerVisible(visible) {
	const banner = document.getElementById('offcampus-banner')
	if (banner) banner.style.display = visible ? 'block' : 'none'
}

/**
 * GPS FIX HANDLER — the single funnel for every position update, real or
 * simulated. The avatar + camera follow the player anywhere in the world;
 * the banner just says whether challenges are currently playable. The
 * campus gate is enforced when a stop is tapped, never on movement.
 */
function handleGpsFix(lng, lat, { accuracy = 0, source = 'real GPS' } = {}) {
	const inside = isInsideCampus(lng, lat)
	demoMode = false
	setBannerVisible(!inside)
	movePlayerTo([lng, lat], {
		center: followMode,
		accuracy,
	})
	const acc = Math.round(accuracy)
	if (inside) {
		setStatusChip(
			'live',
			`On campus (${source})${acc ? ` · ±${acc}m` : ''}`
		)
	} else {
		setStatusChip(
			'away',
			`Off campus (${source}) — visit Wits to play`
		)
	}
	lastInside = inside
}

function enterDemoMode(reason) {
	demoMode = true
	lastInside = true
	setBannerVisible(false)
	movePlayerTo([...CAMPUS_HOME], { center: true })
	setStatusChip(
		'demo',
		reason ?? 'GPS unavailable — demo at Great Hall (WASD to walk)'
	)
}

function startWatch() {
	if (watchId !== null) {
		navigator.geolocation.clearWatch(watchId)
		watchId = null
	}
	watchId = navigator.geolocation.watchPosition(
		(pos) => {
			handleGpsFix(
				pos.coords.longitude,
				pos.coords.latitude,
				{
					accuracy: pos.coords.accuracy ?? 0,
					source: 'real GPS',
				}
			)
		},
		(err) => {
			if (!demoMode && playerMarker) {
				// Had a fix and lost it: keep last dot, say so.
				setStatusChip(
					'demo',
					'GPS signal lost — showing last fix'
				)
				return
			}
			enterDemoMode(
				err.code === 1
					? 'Location blocked — demo at Great Hall (WASD to walk)'
					: 'GPS unavailable — demo at Great Hall (WASD to walk)'
			)
		},
		{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
	)
}

function initUserPosition() {
	setStatusChip('locating', 'Locating…')
	if (!('geolocation' in navigator)) {
		enterDemoMode(
			'No geolocation — demo at Great Hall (WASD to walk)'
		)
		return
	}
	startWatch()
}

// Dev-test panel (v4): real GPS vs simulated fixes.
function setupGeoPanel() {
	document.getElementById('btn-real-gps')?.addEventListener(
		'click',
		() => {
			if (!('geolocation' in navigator)) {
				setStatusChip(
					'away',
					'Geolocation not available — try a simulated fix'
				)
				return
			}
			navigator.geolocation.getCurrentPosition =
				originalGeolocationGetPos
			followMode = true
			setStatusChip(
				'locating',
				'Requesting location permission…'
			)
			startWatch()
		}
	)
	document.getElementById('btn-sim-oncampus')?.addEventListener(
		'click',
		() => {
			if (watchId !== null && 'geolocation' in navigator) {
				navigator.geolocation.clearWatch(watchId)
				watchId = null
			}
			followMode = true
			handleGpsFix(SIM_ON_CAMPUS[0], SIM_ON_CAMPUS[1], {
				source: 'simulated',
			})
			navigator.geolocation.getCurrentPosition = (
				handle,
				handleError
			) => {
				handle({
					coords: {
						latitude: playerCoords[1],
						longitude: playerCoords[0],
					},
				})
			}
		}
	)
	document.getElementById('btn-sim-offcampus')?.addEventListener(
		'click',
		() => {
			if (watchId !== null && 'geolocation' in navigator) {
				navigator.geolocation.clearWatch(watchId)
				watchId = null
			}
			handleGpsFix(SIM_OFF_CAMPUS[0], SIM_OFF_CAMPUS[1], {
				source: 'simulated',
			})
			navigator.geolocation.getCurrentPosition = (
				handle,
				handleError
			) => {
				handle({
					coords: {
						latitude: playerCoords[1],
						longitude: playerCoords[0],
					},
				})
			}
		}
	)
}

/**
 * AUTHENTICATION SESSION CHECK
 */
/**
 * AUTH SESSION TRACKER
 * Asks the backend "is there a valid session for this browser?" via the
 * session cookie. Sets the module-level currentUser variable (used by
 * handleChallengeAttempt's auth gate) and updates the nav bar to show
 * either a login link or the logged-in user's name + logout button.
 */
async function checkAuthSession() {
    try {
        const res = await fetch(`${API_BASE}/api/me`, {
            method: "GET",
            credentials: "include",
        });

<<<<<<< HEAD
        if (res.ok) {
            const user = await res.json();
            currentUser = user;
            updateAuthNav(user);
        } else {
            // 401 from the backend — no valid session.
            currentUser = null;
            updateAuthNav(null);
        }
    } catch (err) {
        // Backend unreachable — treat the same as "not logged in" rather than
        // crashing the page.
        currentUser = null;
        updateAuthNav(null);
    }
    // Profile is only meaningful when a user is signed in — hide the
    // trigger entirely for guests rather than showing an empty modal.
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", handleLogout);
    }
}

async function handleLogout() {
    try {
        // Clear both Better Auth session and express-session bridge
        await clearBridgeSession();
        await baSignOut();
    } catch (err) {
        console.error("Logout error:", err);
    }
    // Return to the landing page so the user can log in again from the single
    // login entry point.
    window.location.href = "/";
=======
		if (res.ok) {
			const user = await res.json()
			currentUser = user
			updateAuthNav(user)
		} else {
			// 401 from the backend — no valid session.
			currentUser = null
			updateAuthNav(null)
		}
	} catch (err) {
		// Backend unreachable — treat the same as "not logged in" rather
		// than crashing the page.
		currentUser = null
		updateAuthNav(null)
	}

	const btnLogout = document.getElementById('btn-logout')
	if (btnLogout) {
		btnLogout.addEventListener('click', handleLogout)
	}
}

async function handleLogout() {
	await logout()
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
}

/**
 * TRIVIA HANDLER — campus-gated on tap. Stops are visible and tappable
 * from anywhere in the world; attempting one requires being on campus.
 */
<<<<<<< HEAD
function clearMapMarkers() {
    mapMarkers.forEach((marker) => marker.remove());
    mapMarkers = [];
}

async function renderCampusEvents(map) {
    clearMapMarkers();

    const buildingsList = await fetchCampusEvents();
    buildingsList.forEach((building) => {
        const marker = L.marker(building.coordinates, {
            icon: buildingIcon,
        }).addTo(map);
        marker.bindPopup(buildPopupContent(building));
        mapMarkers.push(marker);
    });
=======
window.handleChallengeAttempt = async function (eventId) {
	if (!currentUser) {
		openAuthDrawer()
		return
	}

	if (!isInsideCampus(playerCoords[0], playerCoords[1])) {
		showGateModal()
		return
	}

	// Ask the browser for a fresh position fix for this attempt. If the
	// one-shot fix fails (flaky desktop GPS), fall back to the tracked
	// avatar position — the backend distance-checks honestly either way.
	let coords
	try {
		coords = await get_player_location() // returns [latitude, longitude]
	} catch (err) {
		coords = [playerCoords[1], playerCoords[0]]
	}
	const [lat, lng] = coords

	try {
		const res = await fetch(
			`${API_BASE}/api/trivia/event/${eventId}?lat=${lat}&lng=${lng}`,
			{
				credentials: 'include', // sends the session cookie so the backend's requireAuth check can identify who's asking
			}
		)
		if (res.status === 401) {
			// Session cookie expired or was invalidated server-side.
			openAuthDrawer()
			return
		}
		if (res.status === 403) {
			// Location check failed server-side — player is outside the
			// event's radius. Show them how far off they are.
			const data = await res.json()
			alert(
				`You're too far from this location to attempt the challenge. ` +
					`You're about ${data.distance_meters}m away (need to be within ${data.radius_meters}m).`
			)
			return
		}
		if (!res.ok)
			return alert(
				'No trivia challenges available for this location right now!'
			)

		const trivia = await res.json()
		showTriviaModal(eventId, trivia)
	} catch (err) {
		alert('Error connecting to challenge server.')
	}
}

function showGateModal() {
	let modal = document.getElementById('trivia-modal')
	if (!modal) {
		modal = document.createElement('div')
		modal.id = 'trivia-modal'
		modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 10000;`
		document.body.appendChild(modal)
	}

	modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center;">
      <div style="font-size: 2rem;">🏛️</div>
      <h3 style="margin: 8px 0;">On-campus challenge</h3>
      <p style="margin: 12px 0; color: #555;">You need to be on Wits campus to attempt this challenge. Come visit us to play!</p>
      <button style="margin-top: 4px; background: #2f9df0; color: #fff; border: none; border-radius: 6px; padding: 10px 24px; font-weight: bold; cursor: pointer;" onclick="document.getElementById('trivia-modal').remove()">Got it</button>
    </div>
  `
}

function showTriviaModal(eventId, trivia) {
	// Stop any countdown from a previous question if the modal is being
	// reused before its timer ran out.
	if (activeTriviaTimer) {
		clearInterval(activeTriviaTimer)
		activeTriviaTimer = null
	}

	const startedAt = Date.now()
	const timeLimitMs = (trivia.time_limit_s || 30) * 1000

	let modal = document.getElementById('trivia-modal')
	if (!modal) {
		// Reuse the same modal element across multiple challenge attempts
		// instead of creating a new one every time.
		modal = document.createElement('div')
		modal.id = 'trivia-modal'
		modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;
      z-index: 10000;
    `
		document.body.appendChild(modal)
	}

	// Each button carries its option_id in a data attribute; an event
	// listener below wires it up so the click handler can compute the
	// real elapsed time (instead of a hardcoded value).
	const optionsHtml = trivia.options
		.map(
			(opt) => `
    <button data-opt-id="${opt.option_id}" class="trivia-option-btn"
            style="display: block; width: 100%; margin: 8px 0; padding: 10px; border-radius: 4px; border: 1px solid #ccc; cursor: pointer;">
      ${escapeHtml(opt.body)}
    </button>
  `
		)
		.join('')

	// If the player has ALREADY earned this event's card, show a clear
	// banner BEFORE they answer — replay is for practice, no new card.
	const elig = trivia.card_eligibility
	const earnedCardName = elig?.earned_card?.name
	const alreadyEarnedBanner = elig?.already_earned
		? `<div style="margin: 8px 0 12px; padding: 10px 12px; background: #fff8e1; border: 1px solid #ffd54f; border-left: 4px solid #ffb300; border-radius: 6px; color: #7a5c00; font-size: 0.85rem;">
         🎓 You've already earned ${earnedCardName ? `the <strong>${escapeHtml(earnedCardName)}</strong> ` : ''}card for this challenge — replay for practice? No new card will be awarded.
       </div>`
		: ''

	modal.innerHTML = `
    <div style="background: #fff; padding: 24px; border-radius: 8px; max-width: 400px; width: 90%;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;">🎯 Campus Challenge</h3>
        <div id="trivia-timer-text" style="font-variant-numeric:tabular-nums;font-weight:600;font-size:0.85rem;color:#475569;"></div>
      </div>
      <div style="height:6px;border-radius:999px;background:#e5e7eb;margin-bottom:12px;overflow:hidden;">
        <div id="trivia-timer-bar" style="height:100%;background:#0c2461;border-radius:999px;transition:width 100ms linear,background-color 200ms;width:100%;"></div>
      </div>
      ${alreadyEarnedBanner}
      <p style="margin: 12px 0;"><strong>${escapeHtml(trivia.body)}</strong></p>
      <div id="trivia-options">${optionsHtml}</div>
      <div id="trivia-result" style="margin-top: 12px;"></div>
      <button id="trivia-close-btn" style="margin-top: 12px; background: none; border: none; color: #888; cursor: pointer; text-decoration: underline;">Close</button>
    </div>
  `

	// Wire option buttons via addEventListener — computes elapsed since
	// the question opened and disables the rest to prevent double-submit.
	let submitted = false
	const submit = async (optionId, timedOut) => {
		if (submitted) return
		submitted = true
		if (activeTriviaTimer) {
			clearInterval(activeTriviaTimer)
			activeTriviaTimer = null
		}
		const elapsed = Date.now() - startedAt
		modal.querySelectorAll('.trivia-option-btn').forEach(
			(b) => (b.disabled = true)
		)
		await window.submitTriviaAnswer(
			eventId,
			trivia.question_id,
			optionId,
			{
				timed_out: timedOut,
				elapsed_ms: elapsed,
			}
		)
	}
	modal.querySelectorAll('.trivia-option-btn').forEach((btn) => {
		btn.addEventListener('click', () => {
			submit(Number(btn.dataset.optId), false)
		})
	})
	modal.querySelector('#trivia-close-btn').addEventListener(
		'click',
		() => {
			if (activeTriviaTimer) {
				clearInterval(activeTriviaTimer)
				activeTriviaTimer = null
			}
			modal.remove()
		}
	)

	// Countdown bar — ticks every 100 ms, blue → amber (<10 s) → red
	// (<5 s), auto-submits as timed_out at zero.
	const barEl = modal.querySelector('#trivia-timer-bar')
	const textEl = modal.querySelector('#trivia-timer-text')
	const tick = () => {
		const elapsed = Date.now() - startedAt
		const remaining = Math.max(0, timeLimitMs - elapsed)
		const pct = (remaining / timeLimitMs) * 100
		barEl.style.width = pct + '%'
		textEl.textContent = Math.ceil(remaining / 1000) + 's'
		if (remaining < 5000) {
			barEl.style.background = '#dc2626'
			textEl.style.color = '#dc2626'
		} else if (remaining < 10000) {
			barEl.style.background = '#f59e0b'
			textEl.style.color = '#b45309'
		} else {
			barEl.style.background = '#0c2461'
			textEl.style.color = ''
		}
		if (remaining <= 0) {
			submit(null, true)
		}
	}
	tick()
	activeTriviaTimer = setInterval(tick, 100)
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
}

window.submitTriviaAnswer = async function (
	eventId,
	questionId,
	optionId,
	opts = {}
) {
	const { timed_out: timedOut = false, elapsed_ms: elapsedMs = 0 } = opts
	const optionsContainer = document.getElementById('trivia-options')
	const resultContainer = document.getElementById('trivia-result')

	// Disable all answer buttons immediately so the player can't click a
	// second option while the first request is still in flight.
	if (optionsContainer) {
		optionsContainer
			.querySelectorAll('button')
			.forEach((btn) => (btn.disabled = true))
	}

	// Get a fresh location fix for this submission specifically — if the
	// player wandered off after opening the question, this catches it. If
	// the one-shot fix fails (flaky desktop GPS), fall back to the tracked
	// avatar position so the submit always carries coordinates — the
	// backend still distance-checks honestly, so this can't sneak in a
	// far-away answer.
	let lat = null
	let lng = null
	try {
		;[lat, lng] = await get_player_location()
	} catch (err) {
		lat = playerCoords[1]
		lng = playerCoords[0]
		if (resultContainer) {
			resultContainer.innerHTML = `<p style="color: #b45309;">Live GPS fix failed (${escapeHtml(err.message)}) — submitting with your last known position; distance will still be checked.</p>`
		}
	}

	const body = {
		event_id: eventId,
		question_id: questionId,
		answer_time_ms: elapsedMs,
		timed_out: !!timedOut,
	}
	if (!timedOut) body.selected_option_id = optionId
	if (lat !== null) body.claimed_lat = lat
	if (lng !== null) body.claimed_lng = lng

	try {
		const res = await fetch(`${API_BASE}/api/trivia/submit`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(body),
		})

		if (res.status === 401) {
			alert('Your session has expired. Please log in again.')
			openAuthDrawer()
			return
		}

		const data = await res.json()

		if (!res.ok) {
			if (resultContainer) {
				resultContainer.innerHTML = `<p style="color: #c0392b;">${escapeHtml(data.error) || 'Something went wrong submitting your answer.'}</p>`
			}
			return
		}

		// ── Result view ───────────────────────────────────────
		if (resultContainer) {
			if (optionsContainer)
				optionsContainer.style.display = 'none'

			let statusIcon, statusText, statusColor
			if (data.timed_out) {
				statusIcon = '⏰'
				statusText = "Time's up!"
				statusColor = '#b45309'
			} else if (data.location_verified === false) {
				statusIcon = '📍'
				statusText =
					'Too far away — attempt did not count.'
				statusColor = '#b45309'
			} else if (data.is_correct) {
				statusIcon = '✅'
				statusText = 'Correct!'
				statusColor = '#16a34a'
				markEventCompleted(eventId)
				refreshNextSuggested()
				flyToNextSuggested()
			} else {
				statusIcon = '❌'
				statusText = 'Incorrect.'
				statusColor = '#dc2626'
			}

			const elapsedSec = (
				(data.answer_time_ms || 0) / 1000
			).toFixed(1)
			const limitSec = data.time_limit_s || 30

			const correctHtml = data.correct_option_text
				? `<div style="margin-top:10px;padding:8px 12px;border-radius:6px;background:#ecfdf5;border:1px solid #bbf7d0;font-size:0.85rem;color:#065f46;"><strong>Correct answer:</strong> ${escapeHtml(data.correct_option_text)}</div>`
				: ''

			let cardBlock = ''
			if (data.card_awarded && data.awarded_card) {
				const c = data.awarded_card
				cardBlock = `
					<div style="margin-top:12px;padding:10px 12px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;">
						<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:4px;">Card awarded</div>
						<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
							<div style="font-weight:600;color:#0f172a;">${escapeHtml(c.name)}</div>
							${rarityBadge(c.rarity)}
						</div>
					</div>`
			} else if (data.already_earned_card) {
				cardBlock = `<div style="margin-top:8px;font-size:0.8rem;color:#9ca3af;">You've already earned this event's card.</div>`
			}

			resultContainer.innerHTML = `
				<div style="text-align:center;margin:8px 0 12px;">
					<div style="font-size:2rem;line-height:1;">${statusIcon}</div>
					<div style="font-weight:700;font-size:1rem;color:${statusColor};margin-top:4px;">${statusText}</div>
				</div>
				${correctHtml}
				<div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:8px;">
					<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;color:#475569;">
						<span>Time taken</span>
						<span style="font-variant-numeric:tabular-nums;font-weight:600;color:#0f172a;">${elapsedSec}s <span style="color:#9ca3af;font-weight:400;">/ ${limitSec}s</span></span>
					</div>
					<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:0.85rem;color:#475569;">
						<span>Points earned</span>
						<span style="font-weight:600;color:${data.points_awarded > 0 ? '#16a34a' : '#9ca3af'};">${data.points_awarded > 0 ? '+' + data.points_awarded : '0'}</span>
					</div>
				</div>
				${cardBlock}
			`
		}
	} catch (err) {
		if (resultContainer) {
			resultContainer.innerHTML = `<p style="color: #c0392b;">Failed to submit answer. Ensure you are signed in.</p>`
		}
	}
}

/**
 * INITIALIZE WITS MAP ENGINE — world gamified map, live GPS dot, event
 * stops always visible, challenge attempts campus-gated on tap.
 */
async function initializeApp() {
<<<<<<< HEAD
    mapInstance = L.map("map", {
        center: CONFIG.CENTER_COORDINATES,
        zoom: CONFIG.DEFAULT_ZOOM,
        minZoom: CONFIG.MIN_ZOOM,
        maxZoom: CONFIG.MAX_ZOOM,
        maxNativeZoom: 18,
    });

    L.tileLayer(CONFIG.TILE_URL, {
        attribution: CONFIG.TILE_ATTRIBUTION,
        maxZoom: 19,
        maxNativeZoom: 18,
    }).addTo(mapInstance);

    // Must resolve BEFORE placing markers below — buildPopupContent()
    // renders a different popup depending on hasChallenge, and clicking
    // "Attempt Challenge" checks currentUser, so auth state has to be known
    // before a player can possibly interact with a pin.
    await checkAuthSession();

    await renderCampusEvents(mapInstance);

    // Keep the map in sync with admin console changes without forcing a
    // manual page reload.
    setInterval(() => renderCampusEvents(mapInstance), 30000);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) renderCampusEvents(mapInstance);
    });

    setupPlayerGeolocation(mapInstance);
=======
	map = new maplibregl.Map({
		container: 'map',
		style: createCampusStyle(),
		center: CAMPUS_CAMERA.center,
		zoom: CAMPUS_CAMERA.zoom,
		pitch: CAMPUS_CAMERA.pitch,
		bearing: CAMPUS_CAMERA.bearing,
		minZoom: CAMPUS_MIN_ZOOM,
		maxZoom: CAMPUS_MAX_ZOOM,
		// NOTE: maxPitch must be set explicitly — MapLibre v3 defaults to
		// 60 and silently clamps anything steeper, which is why pitch 65
		// previously never visibly landed.
		minPitch: CAMPUS_MIN_PITCH,
		maxPitch: CAMPUS_MAX_PITCH,
		attributionControl: { compact: true },
	})

	map.addControl(
		new maplibregl.NavigationControl({ visualizePitch: true }),
		'bottom-right'
	)
	map.on('zoom', updateAccuracyCircle)
	// Dragging the map pauses follow (PoGo-style); 🎯 resumes it.
	map.on('dragstart', () => {
		if (!demoMode && followMode) {
			followMode = false
			setStatusChip('demo', 'Free look — 🎯 to follow GPS')
		}
	})

	// Soft pull-back: if the player free-looks far from campus and goes
	// idle, ease the camera home instead of stranding them elsewhere.
	clearPullback()
	map.on('movestart', clearPullback)
	map.on('moveend', armPullback)
	map.on('moveend', refreshFactStops)

	let tilted = true
	document.getElementById('btn-tilt')?.addEventListener('click', () => {
		tilted = !tilted
		map.easeTo({ pitch: tilted ? 72 : 60, duration: 600 })
	})
	document.getElementById('btn-reset')?.addEventListener('click', () => {
		tilted = true
		map.easeTo({ ...CAMPUS_CAMERA, duration: 700 })
	})

	map.on('load', async () => {
		// 0. Matte ground texture under the roads.
		addGroundTexture(map, 'water')
		// 1. Live GPS dot, geofenced (or clearly-labelled demo at Great Hall)
		setupMovementControls()
		setupGeoPanel()
		setupOrientation()
		startDayNightCycle(map)
		initUserPosition()

		// 2. Render Wits Campus Pins (and re-render periodically + when
		// the tab becomes visible, so console-created/edited events show
		// up without a manual page reload).
		const renderEventPins = async () => {
			// Don't yank markers while the player is mid-challenge or
			// reading a popup.
			if (
				document.getElementById('trivia-modal') ||
				document.querySelector('.maplibregl-popup')
			)
				return
			try {
				for (const s of stopMarkers) s.marker.remove()
				stopMarkers.length = 0
				const buildings = await fetchCampusEvents()
				buildings.forEach((bld) => {
					const pinElement =
						createBuildingPinElement(bld)
					const popup = new maplibregl.Popup({
						offset: 25,
					}).setHTML(buildPopupContent(bld))

					const marker = new maplibregl.Marker({
						element: pinElement,
						anchor: 'bottom',
					})
						.setLngLat(bld.coordinates)
						.setPopup(popup)
						.addTo(map)
					stopMarkers.push({
						marker,
						el: pinElement.querySelector(
							'.pokestop-bob'
						),
						pinEl: pinElement,
						id: bld.id,
						lng: bld.coordinates[0],
						lat: bld.coordinates[1],
					})
				})
				applyNextSuggestedMarker()
				renderProximityCircles(buildings)
				refreshStopGlow()
				refreshFactStops()
			} catch (err) {
				console.error('Building pin error:', err)
			}
		}
		await renderEventPins()
		setInterval(renderEventPins, 30000)
		document.addEventListener('visibilitychange', () => {
			if (!document.hidden) renderEventPins()
		})

		// 2b. (World tiles render their own buildings; stops are the
		// tappable gameplay layer and are always rendered above.)

		// 3. Silent auth check
		await checkAuthSession().catch(() => {})

		// 4. 🎯 resumes GPS follow and flies to the player, wherever
		// they are in the world.
		document.getElementById('recenter-btn')?.addEventListener(
			'click',
			() => {
				followMode = true
				ensurePlayerMarker()
				map.flyTo({
					center: playerCoords,
					zoom: Math.max(map.getZoom(), 18.5),
					pitch: 72,
					bearing: 0,
					duration: 900,
				})
				if (!demoMode)
					setStatusChip(
						'live',
						'📍 Following GPS'
					)
			}
		)
	})
}

window.openAuthDrawer = () => {
	document.getElementById('auth-overlay')?.classList.add('open')
	document.getElementById('auth-drawer')?.classList.add('open')
}

window.closeAuthDrawer = () => {
	document.getElementById('auth-overlay')?.classList.remove('open')
	document.getElementById('auth-drawer')?.classList.remove('open')
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
}

// ---------------------------------------------------------------------------
// AUTH SIDE DRAWER FUNCTIONS
// These open/close the auth drawer, handle tab switching, and wire up the
// login/signup forms. Attached to `window` because they're called from
// inline onclick="" attributes in the drawer HTML (index.html).
// ---------------------------------------------------------------------------

function showDrawerStatus(message, isError) {
    const el = document.getElementById("auth-drawer-status");
    if (!el) return;
    el.textContent = message;
    el.className = `auth-status visible ${isError ? "error" : "success"}`;
}

<<<<<<< HEAD
window.openAuthDrawer = function () {
    document.getElementById("auth-overlay")?.classList.add("open");
    document.getElementById("auth-drawer")?.classList.add("open");
};

window.closeAuthDrawer = function () {
    document.getElementById("auth-overlay")?.classList.remove("open");
    document.getElementById("auth-drawer")?.classList.remove("open");
};

=======
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
window.switchAuthTab = function (tab) {
    const loginPanel = document.getElementById("login-panel");
    const signupPanel = document.getElementById("signup-panel");
    const tabs = document.querySelectorAll(".auth-tab");

    if (tab === "login") {
        loginPanel?.classList.add("active");
        signupPanel?.classList.remove("active");
        tabs[0]?.classList.add("active");
        tabs[1]?.classList.remove("active");
    } else {
        signupPanel?.classList.add("active");
        loginPanel?.classList.remove("active");
        tabs[1]?.classList.add("active");
        tabs[0]?.classList.remove("active");
    }
};

window.handleDrawerGoogleAuth = async function () {
    showDrawerStatus("Redirecting to Google...", false);
    const { error } = await googleSignIn();
    if (error) {
        showDrawerStatus("Google auth failed: " + error.message, true);
    }
};
// ---------------------------------------------------------------------------
// PLAYER PROFILE  (points, achievements, daily streak)
//
// Fetched lazily — nothing is loaded until the player actually clicks the
// Profile button. The button itself is only revealed once checkAuthSession()
// has confirmed there is a session.
// ---------------------------------------------------------------------------

async function fetchUserProfile() {
    const res = await fetch(`${API_BASE}/api/profile`, {
        method: "GET",
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error(`Profile fetch failed (${res.status})`);
    }
    return res.json();
}

window.openProfileModal = async function () {
    const overlay = document.getElementById("profile-overlay");
    const modal = document.getElementById("profile-modal");
    const loading = document.getElementById("profile-loading");
    const content = document.getElementById("profile-content");

    overlay?.classList.add("open");
    modal?.classList.add("open");

    if (loading) {
        loading.style.display = "block";
        loading.textContent = "Loading your profile…";
    }
    if (content) content.style.display = "none";

    try {
        const profile = await fetchUserProfile();
        renderProfile(profile);
    } catch (err) {
        if (loading) {
            loading.textContent =
                "Could not load your profile. Try again in a moment.";
        }
    }
};

window.closeProfileModal = function () {
    document.getElementById("profile-overlay")?.classList.remove("open");
    document.getElementById("profile-modal")?.classList.remove("open");
};

function renderProfile(profile) {
    const loading = document.getElementById("profile-loading");
    const content = document.getElementById("profile-content");
    const nameEl = document.getElementById("profile-name");

    if (nameEl) nameEl.textContent = profile.user.name || "Profile";

    const pointsEl = document.getElementById("profile-points");
    if (pointsEl) pointsEl.textContent = String(profile.points ?? 0);

    const streakEl = document.getElementById("profile-streak-current");
    if (streakEl) {
        const n = profile.streak.current;
        streakEl.textContent = n === 1 ? "1 day" : `${n} days`;
    }

    const detailEl = document.getElementById("profile-streak-detail");
    if (detailEl) {
        const parts = [];
        if (profile.streak.longest > 0) {
            parts.push(`Longest streak: ${profile.streak.longest} days`);
        }
        if (profile.streak.activeToday) {
            parts.push("Active today");
        } else if (profile.streak.current > 0) {
            parts.push("Answer a challenge today to keep it going");
        } else {
            parts.push("Answer a challenge today to start a new streak");
        }
        detailEl.textContent = parts.join(" · ");
    }

    const achList = document.getElementById("profile-achievements");
    if (achList) {
        achList.innerHTML = profile.achievements
            .map(
                (a) => `
			<li class="${a.unlocked ? "unlocked" : "locked"}">
				<span class="ach-name">${a.name}</span>
				<span class="ach-desc">${a.description}</span>
			</li>
		`,
            )
            .join("");
    }

    if (loading) loading.style.display = "none";
    if (content) content.style.display = "block";
}

function setupAuthDrawerHandlers() {
    // Username + PIN login form
    const loginPinForm = document.getElementById("drawer-login-pin-form");
    if (loginPinForm) {
        loginPinForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document
                .getElementById("drawer-login-username")
                .value.trim();
            const pin = document.getElementById("drawer-login-pin").value;

            showDrawerStatus("Signing in...", false);
            const { data, error } = await usernameSignIn(username, pin);

            if (error) {
                showDrawerStatus("Login failed: " + error.message, true);
            } else {
                showDrawerStatus("Signed in!", false);
                closeAuthDrawer();
                redirectAfterLogin(data);
            }
        });
    }

    // Username + PIN signup form
    const signupPinForm = document.getElementById("drawer-signup-pin-form");
    if (signupPinForm) {
        signupPinForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = document
                .getElementById("drawer-signup-pin-name")
                .value.trim();
            const username = document
                .getElementById("drawer-signup-username")
                .value.trim();
            const pin = document.getElementById("drawer-signup-pin").value;
            const confirm = document.getElementById(
                "drawer-signup-pin-confirm",
            ).value;

            if (pin !== confirm) {
                showDrawerStatus("PINs do not match.", true);
                return;
            }

            showDrawerStatus("Creating account...", false);
            const { data, error } = await usernameSignUp(name, username, pin);

            if (error) {
                showDrawerStatus("Sign up failed: " + error.message, true);
            } else {
                showDrawerStatus("Account created!", false);
                closeAuthDrawer();
                redirectAfterLogin(data);
            }
        });
    }
}

<<<<<<< HEAD
// Wait for the DOM to be ready before touching any #map / header elements —
// otherwise document.getElementById calls above would return null.
document.addEventListener("DOMContentLoaded", () => {
    setupAuthDrawerHandlers();
    initializeApp();
    // Offline queue: paint the banner immediately (so a queued attempt from
    // a previous session is visible on load), try to flush anything left
    // over, and react to network changes without any user action.
    updateOfflineBanner();
    syncOfflineAttempts();
    window.addEventListener("online", () => {
        syncOfflineAttempts();
    });
    window.addEventListener("offline", () => {
        updateOfflineBanner();
    });
});
=======
document.addEventListener('DOMContentLoaded', () => {
	setupAuthDrawerHandlers()
	initializeApp()
})
>>>>>>> 40834396dfe6d44ff54762633a63c8d5a362bb10
