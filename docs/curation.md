# Curation Workflow — Authoring as Curation

> Content is **drafted → reviewed → published**, campaigns are **scheduled around a term or open day**, stale events are **retired**, and **hard questions** are surfaced for repair. This replaces the old "goes live as written" model.

## 1. Mental model

```
Draft ──► In Review ──► Published ──► Retired ──► Archived
  │           │            │             │           │
  │           └─► Draft    │          Republish     └─► Draft (re-open)
  └─► Archived             └─► Archived/In Review
```

- **Draft** — author working copy. Not visible to players. Not playable.
- **In Review** — awaiting reviewer (another author / `SUPER_ADMIN`). Not visible to players.
- **Published** — visible on the player map/events _iff_ `is_active=TRUE` and inside `starts_at/ends_at` window. Only `Published` events are trivia-playable.
- **Retired** — old/ended events removed from player view but kept for history. Visible in console only under `Retired` filter / Insights.
- **Archived** — cold storage. Hidden from player + most console views unless explicitly filtered.

Campaigns group events around a **term** (e.g. `2026 T1`) or an **open day** (flag + label) with their own window. A question that is repeatedly failed (≥60% wrong, ≥5 attempts) is flagged as **hard** for repair.

## 2. Database

### 2.1 `events` columns added (`app/src/backend/db/schema.sql:458`, `app/src/backend/server.js:249`)

| Column                        | Type                                                         | Default | Notes                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `curation_status`             | `ENUM('DRAFT','IN_REVIEW','PUBLISHED','RETIRED','ARCHIVED')` | `DRAFT` | Migration in `ensure_curation_schema()` is idempotent (`ALTER ...` swallowed on `ER_DUP_FIELDNAME`). Backfill: `UPDATE events SET curation_status='PUBLISHED' WHERE curation_status='DRAFT' AND is_active=TRUE` so pre-migration live events stay live. |
| `campaign_id`                 | `INT NULL FK campaigns(campaign_id) ON DELETE SET NULL`      | `NULL`  | Optional link.                                                                                                                                                                                                                                          |
| `retired_at` / `published_at` | `DATETIME NULL`                                              | `NULL`  | Reserved for future timestamping (currently status is the source of truth).                                                                                                                                                                             |

### 2.2 `campaigns` table (`app/src/backend/db/schema.sql:461`)

```sql
CREATE TABLE campaigns (
  campaign_id INT PK,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  term VARCHAR(100),               -- e.g. "2026 T1"
  is_open_day BOOLEAN DEFAULT FALSE,
  open_day_label VARCHAR(255),     -- e.g. "March Open Day 2026"
  starts_at / ends_at DATETIME,    -- UTC, same semantics as events
  status ENUM('DRAFT','SCHEDULED','ACTIVE','ARCHIVED') DEFAULT 'DRAFT',
  created_by FK users(user_id),
  created_at / updated_at DATETIME
);
```

- `DRAFT` — being planned.
- `SCHEDULED` — window set, not yet active.
- `ACTIVE` — `starts_at <= UTC_TIMESTAMP() <= ends_at` (or open-ended).
- `ARCHIVED` — past campaigns.

### 2.3 No schema change for analytics

Hard-question detection is a read-only aggregation over existing `trivia_questions`, `trivia_options`, `trivia_attempts`. Stale detection uses `events.ends_at/created_at` + `curation_status`.

## 3. Backend API

All curation endpoints require session + author role (`SUPER_ADMIN` or `EVENT_AUTHOR`) via `requireEventAuthor()` (`app/src/backend/routes/events.js:53`, `campaigns.js:14`, `analytics.js:12`). Public reads do not.

### 3.1 Events (`app/src/backend/routes/events.js:4`)

**Constants**

```js
const VALID_CURATION = [
	'DRAFT',
	'IN_REVIEW',
	'PUBLISHED',
	'RETIRED',
	'ARCHIVED',
]
const TRANSITIONS = {
	DRAFT: ['IN_REVIEW', 'ARCHIVED'],
	IN_REVIEW: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
	PUBLISHED: ['RETIRED', 'ARCHIVED', 'IN_REVIEW'],
	RETIRED: ['ARCHIVED', 'PUBLISHED'],
	ARCHIVED: ['DRAFT'],
}
```

**Modified endpoints**

| Method                     | Path   | Change                                                                                                                                                                                       |
| -------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/events`          | public | Now `WHERE curation_status='PUBLISHED' AND is_active=TRUE AND in-window` if column exists (`hasCurationColumn()`). Fallback to old `is_active+window` for migration safety (`events.js:79`). |
| `GET /api/events?all=true` | author | Unchanged — returns every row (including draft/retired) ordered by `created_at`.                                                                                                             |
| `POST /api/events`         | author | Accepts `curation_status` (validated) + `campaign_id`; defaults `DRAFT`. Handles both migrated and unmigrated DBs by building SQL with/without the columns (`events.js:142`).                |
| `PUT /api/events/:id`      | author | Same, plus validates transition `TRANSITIONS[from] includes to` and rejects invalid (`400 Invalid transition X → Y`) (`events.js:204`).                                                      |

**New endpoints**

```
POST /api/events/:id/transition  { to: VALID_CURATION }  → 200 { message: "Transitioned FROM → TO" }
POST /api/events/:id/retire                               → 200 { message: "Event retired" }  (sets RETIRED + is_active=FALSE)
```

`transition` additionally blocks `→ PUBLISHED` if the event has zero `trivia_questions` (`400 Cannot publish without at least one question`).

### 3.2 Campaigns (`app/src/backend/routes/campaigns.js:1`)

```
GET    /api/campaigns                — public: SCHEDULED|ACTIVE inside window
GET    /api/campaigns?all=true       — author: all, ordered by starts_at
GET    /api/campaigns/:id            — detail + { events: [...] }
GET    /api/campaigns/:id/events     — events for campaign
POST   /api/campaigns                — { name*, description, term, is_open_day, open_day_label, starts_at, ends_at, status }
PUT    /api/campaigns/:id
DELETE /api/campaigns/:id            — unlinks events (campaign_id=NULL) then deletes
POST   /api/campaigns/:id/events     — { event_ids: [1,2] } bulk links
DELETE /api/campaigns/:id/events/:eventId
```

`toUtcDatetime()` normalises datetimes to UTC `YYYY-MM-DD HH:MM:SS` for `DATETIME` storage (`campaigns.js:18`, same as `events.js:16`).

### 3.3 Analytics (`app/src/backend/routes/analytics.js:1`)

All `requireAuth + requireEventAuthor`.

```
GET /api/analytics/questions/hard?threshold=0.6&min_attempts=5&limit=20
  → [{
      id, event_id, type, text, event_title,
      attempts, wrong, correct, failure_rate (0..1),
      options: [{ option_id, body, is_correct }]
    }]
  SQL: GROUP BY trivia_questions, HAVING attempts >= ? AND failure_rate >= ?, ORDER BY failure_rate DESC

GET /api/analytics/events/stale?days=30
  → [{ event_id, title, curation_status, starts_at, ends_at, days_since_end }]
  WHERE (ends_at < NOW()-days) OR (ends_at IS NULL AND created_at < NOW()-days AND PUBLISHED)

GET /api/analytics/overview
  → { statusCounts: [{status,count}], campaignCounts, hard_questions, stale_events }
```

Used by the console **Insights** tab.

### 3.4 Trivia gating (`app/src/backend/routes/trivia.js:40`)

```js
function isEventPlayable(ev) {
	if (!ev) return { ok: false, reason: 'Event not found.' }
	if (ev.curation_status && ev.curation_status !== 'PUBLISHED')
		return {
			ok: false,
			reason: 'This event is <status> and not yet published.',
		}
	if (ev.is_active === false)
		return { ok: false, reason: 'This event is inactive.' }
	if (ev.starts_at > now || ev.ends_at < now)
		return { ok: false, reason: '...' }
	return { ok: true }
}
```

- `GET /api/trivia/event/:eventId` — fetches event once, gates on `isEventPlayable()` **before** location checks (`trivia.js:87`). Returns `403` with human reason instead of leaking a question.
- `POST /api/trivia/submit` — re-fetches event and re-gates before grading/scoring (`trivia.js:376`). Keeps the glitch where `is_active` missing in test mocks is tolerated (`=== false` check only).

## 4. Frontend — Author Console (`app/src/frontend/pages/console.html:223`, `app/src/frontend/js/console.js:60`)

### 4.1 Top tabs

`Events | Campaigns | Cards | Insights` (`console.js:204` tab router). `hideAllConsoleUI()` now hides all four. `Campaigns` and `Insights` lazy-load via `loadCampaigns()` / `loadInsightsOverview()+loadHardQuestions()+loadStaleEvents()`.

### 4.2 Events tab

- **Filter chips** — original chips `Active/Scheduled/Inactive/Expired` + injected `Draft/In Review/Published/Retired/Archived` (`console.js:1450` `ensureCurationChips()`). Active set default = all nine (`console.js:106`). Filtering uses `classifyEvent()` which prioritises `curation_status` (`console.js:239`), fallback to old `is_active/window` logic for legacy rows.
- **Event cards** — `buildCardBody()` (`app/src/frontend/js/utils.js:66`) adds curation pill (colour: `PUBLISHED→active green`, `IN_REVIEW→gold`, `RETIRED/ARCHIVED→inactive red`) + campaign pill `🗓 Campaign #id`. `buildEventCard()` (`console.js:370`) injects workflow buttons: `DRAFT→Submit for review`, `IN_REVIEW→Publish / Back to draft`, `PUBLISHED→Retire`, `RETIRED→Republish / Archive`. Buttons `POST .../transition` and reload the list.
- **Event form** — new selects `f-curation` + `f-campaign` (`console.html:660`). `populateCampaignSelect()` (`console.js:420`) fetches `GET /api/campaigns?all=true` and fills the dropdown. `openEventEditForm()` (`console.js:443` async) pre-selects current `campaign_id` and renders `renderCurationActions()` pill buttons inside the form. Submit payload now includes `curation_status + campaign_id` (`console.js:495`).

### 4.3 Campaigns tab (`console.html:1654`, `console.js:1680`)

List (`loadCampaigns`) shows `status/term/open-day` pills + window. Card actions: Edit / Delete (delete unlinks events first). Form: `name*, description, term, status, starts_at/ends_at, is_open_day, open_day_label` + **Linked events** checkbox list (loaded from `GET /api/events?all=true` + `GET /api/campaigns/:id` linked set). On save, diffs checked vs previously linked and `POST /:id/events` / `DELETE /:id/events/:eventId` accordingly.

### 4.4 Insights tab (`console.html:1710`, `console.js:1760`)

- **Overview** (`loadInsightsOverview` → `GET /api/analytics/overview`) renders three stat cards: hard question count, stale event count, events-by-curation bar.
- **Hard questions** (`loadHardQuestions` → `GET /questions/hard`) lists `failure_rate%` in red, attempt counts, options with correct tick, and **Repair** button which switches to `Events` tab → `openEventEditForm(event)` → opens `Questions` sub-tab and scrolls to the question.
- **Stale events** (`loadStaleEvents` → `GET /events/stale`) lists `days_since_end` + **Retire** (calls `POST /api/events/:id/retire`) / **Edit**.

### 4.5 Sub-tabs inside event edit

`Details | Questions | Card Pool` sub-tabs unchanged; Questions/Pool remain disabled until the event has an `event_id` (`setSubTabsEnabled(false)` on new, `true` on edit).

## 5. How to use (author flow)

1. **Draft** — `Events → + New Event` creates `DRAFT` (or choose status). Add location, window, then stay on form to add **Questions** (side tab) and **Card Pool**. Must have ≥1 question to publish.
2. **Review** — click `Submit for review` (card or form). Reviewer opens the draft, checks Questions/Pool, clicks `Publish`.
3. **Published** — appears on player map (`GET /api/events` now filtered). Players can `GET /api/trivia/event/:id` and `POST /submit`. Timing/points/card-rail unchanged.
4. **Campaign** — `Campaigns → + New Campaign` set `term` (e.g. `2026 T1`) or tick `Open day` + label + window (`Scheduled`→`Active` when window arrives). Link events via checkboxes; event form's Campaign picker also assigns singly. Filter or schedule a whole open-day cohort by opening its campaign.
5. **Retire** — after term/open day ends, either `PUBLISHED → Retire` on the card, `POST /events/:id/retire`, or use **Insights → Stale events → Retire** for 30+ day-ended `PUBLISHED` events. Retired events vanish from player view but stay under `Retired` filter for history; `Republish` moves back to `PUBLISHED`.
6. **Repair** — `Insights → Hard questions` shows ≥60% wrong + ≥5 attempts sorted worst-first. Click **Repair** → jumps to that event's Questions → edit wording/options or `FILL_BLANK` answer, save. Re-run Insights to see rate drop.

## 6. Migration & compatibility

- Fresh DB: `schema.sql` creates `campaigns`; `events` columns added by `ensure_curation_schema()` on first boot, backfill keeps live events live.
- Existing DB: `ALTER ... ADD COLUMN` is swallowed if column exists (`ER_DUP_FIELDNAME`); FK on `campaign_id` similarly idempotent. Tests mock `curation_status` as absent → treated as `PUBLISHED` via tolerant `isEventPlayable()`, so old `trivia.test.js` still passes (47/47 backend tests).
- No breaking change to `questions`, `trivia`, `cards`, `event_pool` APIs. Old clients sending no `curation_status` default to `DRAFT` (author flow) or are backfill-adjusted for active seeds.

## 7. File map

```
app/src/backend/db/schema.sql:458          campaigns DDL
app/src/backend/server.js:249              ensure_curation_schema() + FK + backfill, mount /api/campaigns + /api/analytics
app/src/backend/routes/events.js:4,79,142,204,290  curation constants, public filter, POST/PUT, transition/retire
app/src/backend/routes/campaigns.js:1      campaigns CRUD + link
app/src/backend/routes/analytics.js:1      hard / stale / overview
app/src/backend/routes/trivia.js:40,87,376 event playable gate
app/src/frontend/js/utils.js:66            buildCardBody curation+campaign pills
app/src/frontend/pages/console.html:223,660,1654,1710  tabs, form selects, campaigns + insights markup
app/src/frontend/js/console.js:60,106,204,239,370,443,495,1450,1680,1760  tab router, classify/filter, cards, form, campaigns, insights
```

## 8. Verification

- `npm run format` — prettier pass.
- `npm test` — 7 suites / 59 tests (backend `trivia`, `sync`, `leaderboard`; frontend `auth-helpers`, `geolocation`, `daynight`) all green.
- Manual boot: `node app/src/backend/server.js` → `Executing 30 queries … "./db/schema.sql" successfully executed!` + campaigns table present.
