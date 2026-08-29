# Adamas2Aurum

A location-based campus trivia and card-battle game.

---

## Tech Stack

### Frontend
- Plain HTML, CSS, and JavaScript (no framework)
- [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles for the interactive campus map
- No API keys required for map rendering

### Backend
- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/) (hosted on Aiven) via `mysql2/promise`
- `express-session` for session-based authentication (email + PIN login)
- CORS configured for local frontend origins
- The backend **also serves the frontend** statically from port 3000, so
  everything runs same-origin — no separate Vite dev server needed unless you
  want HMR during frontend development

### Tooling
- [Jest](https://jestjs.io/) for frontend and backend unit tests
- [Prettier](https://prettier.io/) for code formatting
- Task management via Taiga (Kanban)

---

## Project Structure

```
Adamas2Aurum/
├── app/
│   └── src/
│       ├── frontend/       # Vite + vanilla JS + Leaflet map
│       │   ├── js/
│       │   ├── css/
│       │   ── pages/      # auth, events, console, map
│       ├── frontend/       # Vanilla JS + Leaflet map (served by backend on :3000)
│       │   ├── js/          # main, console, events, auth, geolocation, utils
│       │   ├── css/         # style.css, map.css
│       │   ├── pages/       # auth, events, console, map
│       └── backend/        # Express API
│           ├── routes/      # auth, events, trivia, questions
│           ├── db/          # schema.sql, seed.sql
│           ├── src/         # auth.js (Better Auth config)
│           └── utils/       # db, response, sql_utils
├── docs/
└── RUNNING.md              # local setup instructions
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **MySQL Server** 8.x (local install or remote/Aiven)
  - The project ships with a local MySQL data directory at
    `app/src/backend/data/mysql/` — on Windows with MySQL Server 8.4
    installed at `C:\Program Files\MySQL\MySQL Server 8.4\`, you can
    start it directly:
    ```powershell
    & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" `
        --datadir="<repo-root>\app\src\backend\data\mysql" `
        --port=3306 --console
    ```
  - Or use the Docker Compose stack in `app/src/backend/docker-compose.yml`
    (`docker compose up -d`) which exposes MySQL on port 8024.

### Environment

Copy `.env.example` to `.env` in the **project root** (the backend loads
`.env` from `../../.env`, not from its own directory):

```bash
cp .env.example .env
```

Key variables:

| Variable | Default | Notes |
|---|---|---|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL user |
| `DB_PASSWORD` | _(empty)_ | MySQL password |
| `DB_NAME` | `wits_quest` | Database name |
| `BETTER_AUTH_URL` | `http://localhost:3000` | Same as backend origin |
| `BETTER_AUTH_SECRET` | _(generate)_ | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `PORT` | `3000` | Backend + frontend port |
| `REQUIRE_LOCATION_VERIFICATION` | `false` | 

### Install & Run

```bash
git clone https://sdp.ms.wits.ac.za/404-found-us/Adamas2Aurum.git
cd Adamas2Aurum
npm install          # root: Vite, Jest, Prettier, serve

cd app/src/backend
npm install          # backend: Express, mysql2, better-auth, dotenv

# Start MySQL (see Prerequisites above), then:
node server.js       # or: npm run dev  (adds --watch for auto-reload)
```

The backend serves the frontend on the **same port** — open
`http://localhost:3000` in your browser. You do **not** need a separate
Vite dev server unless you want HMR during frontend development:

```bash
# Optional — separate Vite dev server with HMR (runs on :5173)
cd app/src/frontend
npm install
npm install better-auth
cd ../../..
npm run start:backend

# Frontend (new terminal)
cd app/src/frontend
npm install
cd ../../..
npm run start:frontend

### Seeding the database

Seeding is **not automatic** — `npm run ` only creates tables if they don't
exist yet (safe, non-destructive). To populate test data (users, events,
trivia questions, etc.), run once:
npm run dev


```

### How It Works

1. **Schema auto-creates** on startup — `server.js` calls
   `initialize_database()` which runs `schema.sql` with
   `CREATE TABLE IF NOT EXISTS` for every table (events, users,
   admin_roles, questions, trivia_questions, trivia_options, …).
   This is safe and non-destructive — existing data is never touched.
2. **Better Auth** auto-creates its own tables (`user`, `session`,
   `account`, `verification`) on the first auth request.
3. **Bridge middleware** runs on every request: if a Better Auth
   session exists, it looks up (or creates) a matching row in the
   `users` table and populates `req.session.user` so that existing
   routes can read `req.session.user.user_id` without modification.
4. **Auth flow**: sign up / sign in via `POST /api/auth/sign-up/email`
   and `POST /api/auth/sign-in/email` (Better Auth), or use the legacy
   PIN-based `POST /api/auth/login` (see Auth Architecture below).
5. **Roles**: the `admin_roles` table stores roles per user
   (`EVENT_AUTHOR`, `SUPER_ADMIN`). Author-only routes check this table
   via the `requireEventAuthor` middleware.

### Seeding the database

Seeding is **not automatic** — startup only creates tables. To populate
seed data (users, events, trivia questions, admin roles), run once:

```bash
cd app/src/backend
npm run db:seed       # runs seed.js → executes db/seed.sql
```

> ⚠️ `db/seed.sql` uses `TRUNCATE` — it wipes and re-inserts all seed
> data. Don't run it on a shared database while teammates are testing.

When running same-origin (the default), the frontend and API are both at
`http://localhost:3000`. With the optional Vite dev server, the frontend
runs at `http://localhost:5173` and proxies API calls to `:3000`.

---

## Questions (User Story 6)

Content authors can attach one or more questions to an event in three
formats — multiple choice, true/false, and fill-in-the-blank — so trivia
isn't identical every time.

### API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| `GET` | `/api/events/:eventId/questions` | Public | List questions for an event. **Does not include `correctAnswer`** — players can't see answers. |
| `POST` | `/api/events/:eventId/questions` | Author | Create a question. Validates type-specific rules (see below). |
| `PUT` | `/api/questions/:id` | Author | Edit a question. Same validation rules. |
| `DELETE` | `/api/questions/:id` | Author | Delete a question. |

### Question shape

```json
{
  "type": "MULTIPLE_CHOICE",      // or "TRUE_FALSE" or "FILL_BLANK"
  "text": "In what year was gold discovered on the Witwatersrand?",
  "correctAnswer": "1886",        // MC: must be one of options; TF: "true"/"false"; FB: answer text
  "options": ["1886", "1901", "1652"]  // MC only; null for other types
}
```

### Validation rules

- **MULTIPLE_CHOICE**: `options` must be a non-empty array;
  `correctAnswer` must be one of the option strings.
- **TRUE_FALSE**: `correctAnswer` must be `"true"` or `"false"`.
- **FILL_BLANK**: `correctAnswer` is the expected answer text (any
  non-empty string).
- Invalid combinations return `400 Bad Request`.

### Console UI

On the event edit view in the admin console (`/pages/console.html`), a
**Questions panel** appears below the event form. It shows all questions
attached to the current event with add/edit/delete controls:

- **Type selector** switches between MC / TF / FB.
- **Options list** (add/remove rows) appears only for multiple choice.
- **Correct answer** field is always shown (with a datalist of options
  for MC).
- **Delete** uses a confirmation modal matching the existing event-delete
  pattern.

### Files

- `app/src/backend/db/schema.sql` — `questions` table (additive)
- `app/src/backend/routes/questions.js` — CRUD route file (new)
- `app/src/backend/server.js` — route registration (additive)
- `app/src/frontend/pages/console.html` — Questions panel + delete modal
- `app/src/frontend/js/console.js` — question CRUD logic (appended)
- `app/src/frontend/css/style.css` — question panel styling (appended)

---

## Auth Architecture

The app supports **two auth systems** running side by side:

| System | Routes | How it works |
|---|---|---|
| **Better Auth** | `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out`, `/api/auth/get-session` | Email + password (or Google OAuth). Better Auth manages its own tables (`user`, `session`, `account`, `verification`). A bridge middleware maps Better Auth sessions to `req.session.user`. |
| **PIN auth** | `/api/auth/login`, `/api/auth/register`, `/api/auth/me`, `/api/auth/logout` | Legacy email + PIN (4-digit). Uses the `users` and `user_credentials` tables. Seeded test account: `admin@wits.ac.za` / PIN `1234`. |

A gate middleware in `server.js` checks the request path: PIN-specific
paths (`/login`, `/register`, `/me`, `/logout`) bypass Better Auth and
fall through to the PIN auth router. All other `/api/auth/*` paths go to
Better Auth.

### Frontend auth

- The **console page** (`/pages/console.html`) uses PIN login
  (`POST /api/auth/login` with `{ email, pin }`).
- The **map page** (`/`) uses Better Auth via the auth drawer
  (`auth-client.js` → Better Auth client SDK).

---

## Team

Developed by **404 Found Us**, Software Design Project — University of the Witwatersrand.
