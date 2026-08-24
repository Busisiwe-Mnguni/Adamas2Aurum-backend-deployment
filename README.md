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
│       |
│       └── backend/        # Express API
│           ├── routes/     # auth, events, trivia
│           ├── db/         # schema.sql, seed.sql
│           └── utils/
├── docs/
└── RUNNING.md              # local setup instructions
```

---

## Getting Started

See [RUNNING.md](./RUNNING.md) for full local setup instructions, including environment variables, running the frontend and backend dev servers, and seeded test accounts.

Quick start:

```bash
git clone <https://sdp.ms.wits.ac.za/404-found-us/Adamas2Aurum.git>
cd Adamas2Aurum
npm install

# Backend (new terminal)
cd app/src/backend
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

```bash
npm run db:seed
```

> ⚠️ This TRUNCATEs and re-inserts all seed data on the **shared** Aiven
> database. Don't run it while teammates are actively testing — check in
> the group chat first. If your login suddenly stops working with
> "Invalid credentials" even though nothing changed, it likely means
> someone else ran `db:seed` (or an older backend re-seeded automatically)
> and your test account got wiped — just log in with a seeded account
> again, or re-run `db:seed` yourself if needed.
```

---

## Team

Developed by **404 Found Us**, Software Design Project — University of the Witwatersrand.