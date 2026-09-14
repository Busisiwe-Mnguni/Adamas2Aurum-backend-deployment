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

/**
 * CUSTOM LEAFLET PIN ICONS
 * Leaflet's default markers are plain teardrop shapes — these divIcons
 * swap in custom HTML/CSS so building pins and the player's own position
 * look visually distinct on the map.
 */
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

/**
 * DYNAMIC DATA FETCHING SERVICE (BACKEND INTEGRATED)
 *
 * Tries to load real events from the backend API first. If that fails —
 * e.g. the backend isn't running, or there's a network error — falls back
 * to a small hardcoded list, so the map still shows *something* instead of
 * a blank screen during development.
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
}

/**
 * POPUP TEMPLATE BUILDER
 * Builds the HTML shown when a player clicks a building pin. Only shows
 * the "Attempt Challenge" button if this building actually has a
 * challenge attached (hasChallenge === true); otherwise shows a plain
 * "no challenge here" message instead.
 */
function buildPopupContent(buildingData) {
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
    </div>
  `;
}

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
}

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
}

/**
 * MAP INITIALIZATION FUNCTION
 * The entry point: sets up the Leaflet map, figures out who's logged in,
 * loads and places all the building pins, and starts tracking the
 * player's live location. Runs once, when the page finishes loading.
 */
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
}

async function initializeApp() {
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
}

// ---------------------------------------------------------------------------
// AUTH SIDE DRAWER FUNCTIONS
// These open/close the auth drawer, handle tab switching, and wire up the
// login/signup forms. All attached to `window` because they're called from
// inline onclick="" attributes in the drawer HTML (index.html).
// ---------------------------------------------------------------------------

function showDrawerStatus(message, isError) {
    const el = document.getElementById("auth-drawer-status");
    if (!el) return;
    el.textContent = message;
    el.className = `auth-status visible ${isError ? "error" : "success"}`;
}

window.openAuthDrawer = function () {
    document.getElementById("auth-overlay")?.classList.add("open");
    document.getElementById("auth-drawer")?.classList.add("open");
};

window.closeAuthDrawer = function () {
    document.getElementById("auth-overlay")?.classList.remove("open");
    document.getElementById("auth-drawer")?.classList.remove("open");
};

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
