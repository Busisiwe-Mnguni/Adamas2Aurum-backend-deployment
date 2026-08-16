# Adamas2Aurum

A location-based campus trivia and card-battle game.

---

## Tech Stack

### **Frontend**

- JavaScript (ESM)

### **Backend**

- Node.js

### **Testing**

- Jest (`jest-environment-jsdom` for frontend, Node environment for backend)

### **Formatting**

- Prettier

---

## Project Structure

```
.
├── package.json
├── .prettierrc.yaml
├── .prettierignore
└── app/
    └── src/
        ├── frontend/     # client-side game logic, UI, geolocation
        └── backend/      # server, game state, API
```

---

## Prerequisites

- Node.js
- npm

---

## Getting Started

Install dependencies:

```bash
npm install
```

Start the backend in dev mode:

```bash
npm run dev
```

Or run it in production mode:

```bash
npm start
```

> **Note:** `dev` and `start` delegate to `app/src/backend`, which needs its own `package.json` with matching `dev` and `start` scripts.

---

## Testing

Tests run on Jest in native ESM mode, split into the two projects `frontend` (jsdom) and `backend` (Node):

```bash
npm test              # run all tests
npm run test:frontend # frontend only
npm run test:backend  # backend only
npm run test:watch    # watch mode
```

Test files are matched as `*.test.js` under each project's `rootDir`.

---

## Formatting

Code style is enforced with Prettier:

```bash
npm run format        # write formatting fixes
npm run format:check  # verify formatting (CI-friendly, no writes)
```
