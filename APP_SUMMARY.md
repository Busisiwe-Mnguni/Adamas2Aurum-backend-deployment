# Adamas2Aurum — App Summary for Agents

## What it is

A location-based campus trivia and card-collection game. Admins create geo-fenced events with trivia questions; players explore a Leaflet map, enter event locations, answer questions, and earn collectible cards.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Plain HTML/CSS/JS, Leaflet.js + OpenStreetMap |
| Backend | Node.js + Express, MySQL via `mysql2/promise` |
| Auth | Express sessions + custom PIN auth; Better Auth for Google OAuth |
| Tests | Jest (frontend + backend) |
| Formatting | Prettier |

The backend serves the frontend statically from `http://localhost:3000` by default.

## Main pages

| Page | File | Audience | Purpose |
|---|---|---|---|
| Landing / login | `app/src/frontend/index.html` | Everyone | Auth drawer with Username + PIN and Google OAuth |
| Player events dashboard | `app/src/frontend/pages/events.html` | Players | List/map of active events, trivia entry point |
| Collection | `app/src/frontend/pages/collection.html` | Players | Cards the user has earned |
| Battle | `app/src/frontend/pages/battle.html` | Players | Card-battle feature |
| Admin console | `app/src/frontend/pages/console.html` | Admins/Authors | CRUD for events, questions, and cards |
| Legacy map page | `app/src/frontend/pages/map.html` | — | Kept but no longer linked from nav |
| Legacy auth page | `app/src/frontend/pages/auth.html` | — | Redirects to `/` |

## Frontend JS modules

- `main.js` — landing-page map, geolocation, event marker rendering, auto-refresh polling
- `events.js` — player events dashboard map + sidebar, auto-refresh
- `collection.js` — card collection UI
- `console.js` — admin console (events, questions, cards)
- `auth-client.js` — login/signup API calls (Username + PIN + Google OAuth)
- `auth-helpers.js` — `isAdmin`, `redirectAfterLogin`, `updateAuthNav`
- `utils.js` — toast, escaping, datetime helpers, card body builder
- `geolocation.js` — browser geolocation helpers
- `qr-scanner.js` — QR camera fallback used when GPS accuracy is too poor
- `constants.js` — API base URL, map config

## Backend routes

| Route | Description |
|---|---|
| `POST /api/auth/login` | PIN login (sends `{ email: username, pin }`) |
| `POST /api/auth/register` | PIN registration |
| `GET /api/auth/me` | Current session user |
| `POST /api/auth/logout` | Logout |
| `GET /api/events` | Public active events (time + geo filtered) |
| `POST /api/events` | Create event (author/admin) |
| `PUT /api/events/:id` | Update event |
| `DELETE /api/events/:id` | Delete event |
| `GET /api/events/:id/questions` | Questions for an event (no answers) |
| `POST /api/events/:id/questions` | Add question |
| `PUT /api/questions/:id` | Edit question |
| `DELETE /api/questions/:id` | Delete question |
| `GET /api/trivia/event/:eventId` | Fetch a random question for an event (location-checked, answers stripped of is_correct) |
| `POST /api/trivia/submit` | Submit a trivia answer (grades server-side, awards points + card) |
| `GET /api/cards` | List cards |
| `GET /api/cards/:id` | Card detail |
| `GET /api/events/:eventId/pool` | List card pool entries for an event (with card details) |
| `POST /api/events/:eventId/pool` | Add a card to an event's pool |
| `PUT /api/events/:eventId/pool/:poolId` | Update pool entry weight/copy limit |
| `DELETE /api/events/:eventId/pool/:poolId` | Remove a card from an event's pool |

## Database tables

`app/src/backend/db/schema.sql` defines:

- `users` — player/author accounts
- `user_credentials` — PIN hashes for local auth
- `admin_roles` — `SUPER_ADMIN`, `EVENT_AUTHOR`, `CARD_AUTHOR`
- `events` — geo-fenced trivia events
- `trivia_questions` + `trivia_options` — questions and answers
- `cards` — collectible cards
- `event_card_pool` / `event_card_awards` — event-to-card linking and award ledger
- `trivia_attempts` — player answer history

Seed data is in `app/src/backend/db/seed.sql`.

## Key features currently implemented

1. **Auth**
   - Username + PIN login/signup (username sent as `email` to the legacy backend)
   - Google OAuth via Better Auth
   - Session-based authentication with role-aware redirects

2. **Role-based routing & navigation**
   - Single login entry point at `/`
   - Players → `events.html`
   - Admins/authors → `console.html`
   - Header shows only role-appropriate links
   - Map nav link removed; Events is the player landing page

3. **Admin console**
   - Create/edit/delete events
   - Attach MC / true-false / fill-blank questions to events
   - Manage cards (full CRUD with 5 rarity tiers: COMMON, UNCOMMON, RARE, EPIC, LEGENDARY)
   - Manage event card pools — add/remove cards from an event's pool, set weight and global copy limits
   - Side sub-tabs (Details / Questions / Card Pool) when editing an event

4. **Player experience**
   - Leaflet map with event markers
   - Timed trivia challenge overlay when near an event (countdown bar + live seconds)
   - Auto-fail on timeout (server-graded as incorrect, with the correct answer still shown)
   - Time-decayed points (linear, 50 % floor) and speed-ranked card rarity brackets
   - Result modal after each answer showing status, correct answer, time taken, points earned, and the card awarded (name + colour-coded rarity badge)
   - Once-only card awards per event with a retry-after-win "already earned" state
   - Collection and battle pages

5. **Live sync**
   - Player map and events dashboard poll every 30 seconds
   - Refresh on `visibilitychange`
   - `cache: 'no-store'` on event fetches

## Timed trivia answer flow

The trivia loop spans three files — `routes/trivia.js` (backend), `services/card_award.js` (speed-ranked card selection), and `js/events.js` (player UI, mirrored in `js/main.js` for the landing-page flow).

**Question fetch (`GET /api/trivia/event/:eventId`):**
- Requires the player to be within `events.radius_meters` of the event's location (GPS or QR-verified fallback)
- Returns a random question + answer options (but never `is_correct` — that stays server-side only)
- Stashes `{ question_id, event_id, issued_at }` in the session so the submit route can compute authoritative server-side elapsed time
- Flags `card_eligibility.already_earned` so the UI can show a practice-mode banner

**Question UI (`showTriviaModal` in events.js):**
- Renders the question with a 6 px countdown bar and live seconds remaining, ticking every 100 ms for a smooth animation
- Bar colour shifts blue → amber (<10 s) → red (<5 s)
- At 0 s the buttons disable and `_submitAnswer` fires with `timed_out: true` (no selected option)
- A `submitted` flag guards against a late user click racing the auto-timeout

**Answer submit (`POST /api/trivia/submit`):**
- Accepts `event_id`, `question_id`, `selected_option_id` (optional when `timed_out: true`), `answer_time_ms`, location params, and the optional `timed_out` flag
- Computes authoritative elapsed: `Date.now() − session.trivia_issue.issued_at` when the question matches; falls back to client `answer_time_ms` otherwise
- 1 s grace on the timeout verdict (network latency); elapsed capped at the time limit for scoring
- **Points formula (linear decay, 50 % floor):**
  `points = max(1, round(point_reward × (1 − elapsed_fraction / 2)))` — near-instant = full reward, full limit = half. Requires correct + location-verified + not timed out.
- **Speed-ranked card bracket:**
  `getEventCardForSpeed(conn, event_id, elapsed_fraction)` fetches all pool entries with copies remaining, sorts rarest-first (LEGENDARY → COMMON, pool_id tie-break), and picks index `min(N-1, floor(elapsed_fraction × N))` — fastest bracket gets the rarest card
- Eligibility unchanged: correct + verified + first win on this event (UNIQUE(user_id, event_id) backstop on `event_card_awards`)

**Response shape:**
```json
{
  "is_correct": true,
  "timed_out": false,
  "location_verified": true,
  "points_awarded": 19,
  "answer_time_ms": 3071,
  "time_limit_s": 30,
  "elapsed_fraction": 0.102,
  "card_awarded": true,
  "awarded_card": { "card_id": 1, "name": "Jan Smuts", "rarity": "LEGENDARY", ... },
  "already_earned_card": false,
  "correct_option_text": "1886"
}
```

**Result modal (`showResultModal` in events.js):**
- Status icon + text (✅ Correct / ❌ Incorrect / ⏰ Time's up / 📍 Too far)
- "Correct answer: X" (always shown, user story 7)
- Time taken: `X.Xs / Ys`
- Points earned: `+N` (green) or `0` (grey)
- Card awarded block with name + rarity badge (grey/green/blue/purple/gold for COMMON/UNCOMMON/RARE/EPIC/LEGENDARY)
- "You've already earned this event's card" note when applicable
- Server-returned strings are `escapeHtml`'d before innerHTML interpolation

## Test accounts

| Username | PIN | Role | Lands on |
|---|---|---|---|
| `alice@example.com` | `1234` | Super admin | Console |
| `player@example.com` | `1234` | Player | Events |

## Running locally

1. Start MySQL (port 3306 by default, or use Docker Compose at `app/src/backend/docker-compose.yml`)
2. `cp app/src/backend/.env.example .env` in the project root and fill in DB credentials
3. `npm install`
4. `cd app/src/backend && npm install`
5. `node server.js` (or `npm run dev` for watch mode)
6. Seed once: `cd app/src/backend && npm run db:seed`
7. Open `http://localhost:3000`

## Entry points for new work

- **Auth / nav / redirects**: `app/src/frontend/js/auth-helpers.js`, `auth-client.js`, `index.html`
- **Player map/events**: `app/src/frontend/js/main.js`, `events.js`
- **Trivia scoring & card awards**: `app/src/backend/routes/trivia.js`, `services/card_award.js`
- **Admin console**: `app/src/frontend/js/console.js`, `pages/console.html`
- **Event card pool API**: `app/src/backend/routes/event_pool.js`
- **Backend API**: `app/src/backend/server.js`, `routes/*.js`
- **Database**: `app/src/backend/db/schema.sql`, `seed.sql`
- **Tests**: `app/src/backend/services/card_award.test.js`, `app/src/frontend/js/geolocation.test.js`

## Recent changes

- **2026-09-08 — Console sub-tab UX fix + event creation is_active fix**
  - Fixed "New Event" form: sub-tabs (Details / Questions / Card Pool) are now always visible when creating a new event, but Questions and Card Pool are disabled (greyed out) until the event is saved — previously the entire tab nav was hidden, making the form look incomplete
  - Fixed POST `/api/events` route: `is_active` is now read from the request body (matching the PUT route) instead of being hardcoded to TRUE — the admin console's "Active" checkbox now works correctly during creation
  - Added `setSubTabsEnabled()` helper and `.sub-tab-btn:disabled` CSS (opacity 0.35, cursor not-allowed)
  - Files touched: `routes/events.js`, `js/console.js`, `css/console-tabs.css`

- **2026-09-08 — Event card pool management + console side sub-tabs**
  - Added full CRUD API for `event_card_pool` (`routes/event_pool.js`) — add/remove cards from an event's pool, update weight and global copy limits
  - Restructured the console event edit view with side sub-tabs (Details / Questions / Card Pool) instead of stacked panels
  - Card Pool panel shows existing pool entries with inline-editable weight/copy limit fields, a dropdown to add cards (sorted by rarity), and a remove confirmation modal
  - Added UNCOMMON and EPIC to the card rarity dropdown and backend validation (was previously missing, only had COMMON/RARE/LEGENDARY)
  - Side sub-tabs collapse to horizontal on mobile (≤720px)
  - Files touched: `routes/event_pool.js` (new), `server.js`, `routes/cards.js`, `pages/console.html`, `css/console-tabs.css`, `js/console.js`

- **2026-09-08 — Timed trivia + result modal + speed-ranked cards**
  - Replaced the old `alert()` after answering with a full result modal showing status (✅/❌/⏰/📍), correct answer, time taken, points earned, and the card awarded (with a colour-coded rarity badge)
  - Added a live countdown bar to the question modal (blue → amber → red) that auto-submits as incorrect on timeout
  - Points are now time-decayed (linear with a 50 % floor) instead of flat — faster answers earn more
  - Card awards are now speed-ranked: faster answers land in higher-rarity brackets from the event's pool (LEGENDARY → COMMON)
  - Server-side elapsed time (from a session-stamped issue timestamp) is now authoritative, preventing clients from faking fast answers to game the card brackets
  - `events.js` now sends the captured location (GPS or QR) at submit time, fixing rejects when location verification is enabled
  - Mirrored in `main.js` for the legacy landing-page flow
  - Files touched: `routes/trivia.js`, `services/card_award.js`, `js/events.js`, `js/main.js`

## Notes for another agent

- The frontend is vanilla JS — no framework. State is kept in module-level variables and `sessionStorage` where needed.
- The backend serves static files from `app/src/frontend` so API and frontend share origin.
- Recent refactor removed email/password from the login drawer and the Map nav link; rely on `auth-helpers.js` for nav/redirect logic.
- If player views look stale after admin changes, the polling/visibility refresh is in `main.js` and `events.js`.
- The console event edit view uses side sub-tabs (Details / Questions / Card Pool) controlled by `resetSubTabs()` and `setSubTabsEnabled()` in `console.js`. When creating a new event, all sub-tabs are visible but Questions and Card Pool are disabled until the event is saved (no event_id yet). When editing, all sub-tabs are enabled.
- Card rarities: COMMON, UNCOMMON, RARE, EPIC, LEGENDARY — all five are supported in the backend, frontend dropdowns, collection display, and speed-ranked card selection.
- The `event_card_pool` table must be populated for an event before players can earn cards from it. Use the Card Pool sub-tab in the console, or seed data in `seed.sql`.

## AI Declaration

This project was developed with the assistance of AI tooling (Qoder). AI was used to help design architecture, write code, debug issues, and document the codebase. All AI-generated contributions were reviewed, tested, and approved by the project author before being committed.
