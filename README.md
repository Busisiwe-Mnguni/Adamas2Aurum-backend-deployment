# Adamas2Aurum

A location-based campus trivia and card-battle game.

---

## Tech Stack

### Frontend
- Plain HTML, CSS, and JavaScript (no framework)
- [Vite](https://vitejs.dev/) as the dev server and build tool
- [Leaflet.js](https://leafletjs.com/) + OpenStreetMap tiles for the interactive campus map
- No API keys required for map rendering

### Backend
- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/) (hosted on Aiven) via `mysql2/promise`
- `express-session` for session-based authentication (email + PIN login)
- CORS configured for local frontend origins (`localhost:5173`, `localhost:8055`)

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
│       │   ├── pages/      # auth, events, console, map
│       │   └── vite.config.js
│       └── backend/        # Express API
│           ├── routes/     # auth, events, trivia
│           ├── db/         # schema.sql, seed.sql
│           └── utils/
├── docs/
├── .env.example
└── RUNNING.md              # local setup instructions
```

---

## Getting Started

See [RUNNING.md](./RUNNING.md) for full local setup instructions, including environment variables, running the frontend and backend dev servers, and seeded test accounts.

Quick start:

```bash
git clone <repo-url>
cd Adamas2Aurum
npm install

# Backend (new terminal)
cd app/src/backend
npm install
npm run dev

# Frontend (new terminal)
cd app/src/frontend
npm run dev
```

Frontend runs at `http://localhost:5173`, backend API at `http://localhost:3000`.

---

## Team

Developed by **404 Found Us**, Software Design Project — University of the Witwatersrand.