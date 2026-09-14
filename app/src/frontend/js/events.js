import { API_BASE } from "./constants.js";
import { get_player_location } from "./geolocation.js";
import { distance } from "./general.js";
import { updateAuthNav } from "./auth-helpers.js";

const AUTH_API = `${API_BASE}/api/auth`;
const EVENT_API = `${API_BASE}/api/events`;

// ── DOM ──────────────────────────────────────────────────────
const btnLogout = document.getElementById("btn-logout");
const elLoading = document.getElementById("map-loading");
const elError = document.getElementById("map-error");
const elSidebar = document.getElementById("map-sidebar");

// ── Map ───────────────────────────────────────────────────────
const map = L.map("map", {
    center: [-26.1929, 28.0305],
    zoom: 16.5,
    minZoom: 14,
    maxZoom: 19,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
}).addTo(map);

// ── Icons ─────────────────────────────────────────────────────
function makeEventIcon(inRange) {
    const bg = inRange ? "#0c2461" : "#7f8fa6";
    return L.divIcon({
        className: "",
        html: `<div style="
			width:30px;height:30px;
			border-radius:50% 50% 50% 0;
			transform:rotate(-45deg);
			background:${bg};
			border:2px solid #fff;
			box-shadow:0 2px 6px rgba(0,0,0,0.25);
			display:flex;align-items:center;justify-content:center;">
			<span style="transform:rotate(45deg);font-size:13px;">🏛️</span>
		</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -32],
    });
}

const playerIcon = L.divIcon({
    className: "",
    html: `<div style="position:relative;width:36px;height:36px;">
		<div style="
			position:absolute;inset:0;border-radius:50%;
			background:rgba(12,36,97,0.25);
			animation:pulse-ring 1.8s infinite ease-out;">
		</div>
		<div style="
			position:absolute;top:2px;left:2px;
			width:32px;height:32px;
			border-radius:50% 50% 50% 0;
			transform:rotate(-45deg);
			background:#0c2461;
			border:2px solid #fff;
			box-shadow:0 3px 8px rgba(0,0,0,0.3);
			display:flex;align-items:center;justify-content:center;">
			<span style="transform:rotate(45deg);font-size:14px;">📍</span>
		</div>
	</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -38],
});

// ── Auth ──────────────────────────────────────────────────────
let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch(`${AUTH_API}/me`, {
            credentials: "include",
        });
        if (!res.ok) throw new Error();
        currentUser = await res.json();
        updateAuthNav(currentUser);
    } catch {
        currentUser = null;
        updateAuthNav(null);
    }
}

btnLogout.addEventListener("click", async () => {
    await fetch(`${AUTH_API}/logout`, {
        method: "POST",
        credentials: "include",
    });
    window.location.href = "../index.html";
});

// ── Geolocation ───────────────────────────────────────────────
let playerMarker = null;
let eventMarkers = [];

function clearEventMarkers() {
    eventMarkers.forEach((marker) => marker.remove());
    eventMarkers = [];
    elSidebar.innerHTML = "";
}

function startGeolocation() {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.watchPosition(
        (pos) => {
            const ll = [pos.coords.latitude, pos.coords.longitude];
            if (!playerMarker) {
                playerMarker = L.marker(ll, {
                    icon: playerIcon,
                })
                    .addTo(map)
                    .bindPopup("📍 You are here");
            } else {
                playerMarker.setLatLng(ll);
            }
        },
        (err) => console.warn("Geolocation:", err.message),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
}

// ── Load events ───────────────────────────────────────────────
async function loadEvents() {
    try {
        clearEventMarkers();
        elError.classList.add("hidden");

        const res = await fetch(EVENT_API, { cache: "no-store" });
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const events = await res.json();

        elLoading.classList.add("hidden");

        if (!events.length) {
            elError.textContent =
                "No active events right now — check back later.";
            elError.classList.remove("hidden");
            return;
        }

        let playerLoc = null;
        try {
            playerLoc = await get_player_location();
        } catch {
            /* fine */
        }

        events.forEach((ev) => {
            const ll = [parseFloat(ev.latitude), parseFloat(ev.longitude)];
            // FIX: distance() expects two {latitude, longitude} objects, not 4 args
            const inRange = playerLoc
                ? distance(
                      {
                          latitude: playerLoc[0],
                          longitude: playerLoc[1],
                      },
                      {
                          latitude: ll[0],
                          longitude: ll[1],
                      },
                  ) <= ev.radius_meters
                : false;

            const marker = L.marker(ll, {
                icon: makeEventIcon(inRange),
            })
                .addTo(map)
                .bindPopup(buildPopup(ev, inRange), {
                    maxWidth: 260,
                });

            eventMarkers.push(marker);
            addSidebarEvent(ev, inRange, marker);
        });
    } catch (err) {
        elLoading.classList.add("hidden");
        elError.textContent = `Could not load events — ${err.message}`;
        elError.classList.remove("hidden");
    }
}

// ── Popup ─────────────────────────────────────────────────────
function buildPopup(ev, inRange) {
    const rangePill = inRange
        ? `<span class="meta-pill active">✓ In range</span>`
        : `<span class="meta-pill">Out of range</span>`;

    const actionHtml = inRange
        ? `<button class="popup-challenge-btn" onclick="window._challenge(${ev.event_id})">⚡ Attempt Challenge</button>`
        : `<p class="popup-out-of-range">Walk closer to attempt this challenge.</p>`;

    return `
		<div class="popup-title">${ev.title}</div>
		<div class="popup-desc">${ev.description || "No description."}</div>
		<div class="popup-meta">
			<span class="meta-pill active">Active</span>
			${rangePill}
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
		</div>
		${actionHtml}
	`;
}

// ── Sidebar ───────────────────────────────────────────────────
function addSidebarEvent(ev, inRange, marker) {
    const card = document.createElement("div");
    card.className = "sidebar-event";

    const rangePill = inRange
        ? `<span class="meta-pill active">✓ In range</span>`
        : `<span class="meta-pill">Out of range</span>`;

    card.innerHTML = `
		<div class="sidebar-event-title">${ev.title}</div>
		<div class="sidebar-event-meta">
			${rangePill}
			<span class="meta-pill gold">⚡ ${ev.point_reward} pts</span>
			<span class="meta-pill">📍 ${ev.radius_meters}m</span>
		</div>
	`;

    card.addEventListener("click", () => {
        map.setView([parseFloat(ev.latitude), parseFloat(ev.longitude)], 18, {
            animate: true,
        });
        marker.openPopup();
        document
            .querySelectorAll(".sidebar-event")
            .forEach((c) => c.classList.remove("active"));
        card.classList.add("active");
    });

    elSidebar.appendChild(card);
}

// ── Challenge + trivia modal ──────────────────────────────────
window._challenge = async function (eventId) {
    if (!currentUser) {
        window.location.href = "../index.html";
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/trivia/event/${eventId}`, {
            credentials: "include",
        });
        if (res.status === 401) {
            window.location.href = "../index.html";
            return;
        }
        if (!res.ok) {
            alert("No trivia challenge available for this event right now.");
            return;
        }
        showTriviaModal(eventId, await res.json());
    } catch {
        alert("Error connecting to the challenge server.");
    }
};

function showTriviaModal(eventId, trivia) {
    document.getElementById("trivia-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.id = "trivia-overlay";
    overlay.style.cssText = `
		position:fixed;inset:0;background:rgba(0,0,0,0.45);
		display:flex;align-items:center;justify-content:center;z-index:10000;
	`;

    const optionsHtml = trivia.options
        .map(
            (opt) => `
		<button onclick="window._submitAnswer(${eventId},${trivia.question_id},${opt.option_id})"
			style="
				display:block;width:100%;margin:6px 0;padding:10px 14px;
				border-radius:var(--radius);border:1px solid var(--border);
				background:var(--surface-2);color:var(--text);
				cursor:pointer;font-size:0.875rem;text-align:left;
				font-family:var(--font-body);
				transition:border-color 180ms ease,background 180ms ease;"
			onmouseover="this.style.borderColor='#0c2461';this.style.background='#f0f4ff'"
			onmouseout="this.style.borderColor='';this.style.background=''">
			${opt.body}
		</button>
	`,
        )
        .join("");

    overlay.innerHTML = `
		<div style="
			background:var(--surface);border:1px solid var(--border);
			border-radius:var(--radius-lg);padding:1.75rem;
			max-width:420px;width:90%;
			box-shadow:0 8px 30px rgba(0,0,0,0.15);
			font-family:var(--font-body);">
			<div style="font-family:var(--font-display);font-weight:700;font-size:1.05rem;color:var(--text);margin-bottom:0.75rem;">
				🎯 Campus Challenge
			</div>
			<p style="font-size:0.875rem;color:var(--text-dim);margin-bottom:1rem;line-height:1.5;">
				${trivia.body}
			</p>
			<div>${optionsHtml}</div>
			<button onclick="document.getElementById('trivia-overlay').remove()"
				style="margin-top:1rem;background:none;border:none;color:var(--text-muted);
					cursor:pointer;font-size:0.8rem;text-decoration:underline;font-family:var(--font-body);">
				Close
			</button>
		</div>
	`;
    document.body.appendChild(overlay);
}

window._submitAnswer = async function (eventId, questionId, optionId) {
    try {
        const res = await fetch(`${API_BASE}/api/trivia/submit`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                event_id: eventId,
                question_id: questionId,
                selected_option_id: optionId,
                answer_time_ms: 1500,
            }),
        });
        if (res.status === 401) {
            alert("Session expired — please sign in again.");
            window.location.href = "../index.html";
            return;
        }
        const data = await res.json();
        document.getElementById("trivia-overlay")?.remove();
        alert(data.message);
    } catch {
        alert("Failed to submit answer.");
    }
};

// ── Boot ──────────────────────────────────────────────────────
await checkAuth();
startGeolocation();
await loadEvents();

// Refresh events when the admin creates/updates them without requiring a
// manual page reload.
setInterval(loadEvents, 30000);
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) loadEvents();
});
