# Adamas2Aurum

A location-based campus trivia and card-battle game.

---

## Tech Stack

### Frontend

- Plain HTML, CSS, and JavaScript (ESM) (no framework)

### Backend

- [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/)
- [MySQL](https://www.mysql.com/) (hosted on Aiven) via `mysql2/promise`

### Tooling

- [Jest](https://jestjs.io/) for frontend and backend unit tests

### Formatting

- [Prettier](https://prettier.io/)

---

## Project Structure

```
Adamas2Aurum/
├── app/
│   └── src/
│       ├── frontend/       # plain JS + Leaflet map
│       │   ├── js/
│       │   ├── css/
│       │   └── pages/      # auth, events, console, map
│       └── backend/        # Express API
│           ├── routes/     # auth, events, trivia
│           ├── websocket/  # websockets (battle, and etc.)
│           ├── db/         # schema.sql, seed.sql
│           └── utils/
├── docs/
├── package.json
├── .prettierrc.yaml
├── .prettierignore
├── setup.py          # automated setup
├── db_connect.py     # connects to the DB via the mysql CLI
└── README.md
```

---

## Prerequisites
 
- Node.js 18+
- npm
- Python 3 - for `setup.py` and `db_connect.py`
- Docker & Docker Compose - only needed for [local DB setup](#local-db-setup)
- MySQL client (`mysql`) - only needed if you want to connect via `db_connect.py`

---

## Getting Started

### Quick start

The setup script installs dependencies, optionally sets up a MySQL DB using Docker, and starts both the backend and frontend. It's cross-platform, so the same command works on macOS, Linux, and Windows:
 
````bash
$ python3 setup.py          # start mode
$ python3 setup.py --dev    # dev mode
````
 
You'll be prompted whether to set up the local database.

### Manual setup

If you'd rather run each step yourself:

1. Install dependencies:

```bash
$ npm run install-deps
```

> **Note:** This runs `npm install` at the project root, then inside `app/src/backend`, since the backend has its own `package.json`.

2. Start the backend:

```bash
$ npm run dev:backend     # dev mode
$ npm run start:backend   # production mode
```

> `dev:backend` and `start:backend` delegate to `app/src/backend`, which needs its own matching `dev` and `start` scripts.

3. Serve the frontend:

```bash
$ npm run dev:frontend     # dev mode
$ npm run start:frontend   # production mode
```

> **Note**: Both currently run the same command (`serve app/src/frontend -l 8055`) - this serves the frontend as static files and does not hot-reload on change.

---

## Local DB setup

This project can be set up to use MySQL locally via Docker.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Setup

1. Copy the example env file:

```bash
$ cp app/src/backend/.env.example app/src/backend/.env
```

2. Start the database:

```bash
$ npm run db:up
```

### Scripts

- Start the database:

```bash
$ npm run db:up
```

- Stop the database:

```bash
$ npm run db:down
```

> **Note:** To delete the DB completely, run `docker compose down -v` from `app/src/backend`.
>
> On Linux (maybe macOS, too), `db:up` might need to be run with `sudo` depending on your Docker install (`setup.py` does not do this, so you would have to go to `app/src/backend/package.json` and add sudo to those scripts manually, or add the current `$USER` to the `docker` group so elevation isn't needed).
>
> On Windows, elevation (apparently) isn't required with Docker Desktop.
 
### Connecting via the MySQL CLI
 
Once the database is running, you can connect to it directly with:
 
````bash
$ python3 db_connect.py
````
 
This reads connection settings from your `app/src/backend/.env` (falling back to sane defaults if it isn't there) and calls the `mysql` client for you, automatically passing `--ssl-ca=app/src/backend/certs/ca.pem` or `--skip-ssl` depending on `DB_SSL`. Requires the `mysql` client to be installed and on your `PATH`.


### Seeding the database

Seeding is not automatic - `npm run dev` only creates tables if they don't
exist yet (safe, non-destructive). To populate test data (users, events,
trivia questions, etc.), run once:

```bash
$ npm run db:seed
```

> This TRUNCATEs and re-inserts all seed data on the **shared** Aiven
> database. Don't run it while teammates are actively testing - check in
> the group chat first. If your login suddenly stops working with
> "Invalid credentials" even though nothing changed, it likely means
> someone else ran `db:seed` (or an older backend re-seeded automatically)
> and your test account got wiped - just log in with a seeded account
> again, or re-run `db:seed` yourself if needed.

---

## Testing

Tests run on Jest with support for ESM:

```bash
$ npm test              # run all tests
$ npm run test:frontend # frontend only
$ npm run test:backend  # backend only
$ npm run test:watch    # watch mode
````

Test files are matched as `*.test.js` under each project's `rootDir`.

---

## Formatting

Code style is maintained with Prettier:

```bash
$ npm run format        # write formatting fixes
$ npm run format:check  # verify formatting (CI-friendly, no writes)
```

---

## Team

Developed by **404 Found Us**, Software Design Project - University of the Witwatersrand.
