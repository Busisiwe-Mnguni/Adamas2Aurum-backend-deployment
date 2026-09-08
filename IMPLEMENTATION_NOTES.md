# Authentication, Navigation & Live Event Sync — Implementation Notes

## Summary

Consolidated the Adamas2Aurum login experience into a single entry point, added role-based post-login routing, cleaned up role-aware navigation, documented seeded test accounts, and made the player-facing map/events dashboard auto-refresh when admins create or update events in the console.

## What was implemented

### 1. Single login entry point
- `index.html` is now the only login UI.
- The auth drawer offers **Username + PIN** and **Google OAuth**.
- Email/password login was removed from the drawer per user feedback.
- Standalone `auth.html` now redirects to `/`.
- `js/auth.js` was removed.

### 2. Role-based redirects
- Created `app/src/frontend/js/auth-helpers.js` with shared helpers:
  - `ADMIN_ROLES` — `SUPER_ADMIN`, `EVENT_AUTHOR`, `CARD_AUTHOR`
  - `isAdmin(user)`
  - `redirectAfterLogin(user)`
  - `updateAuthNav()` for header state
- Backend `/api/auth/login` and `/api/auth/register` now return the user's `roles` array so the frontend can route correctly.
- Players land on `events.html`.
- Admins/authors land on `console.html` immediately after login.

### 3. Navigation cleanup
- Removed the **Map** nav link from all headers; Events is the player landing page.
- Console header no longer shows a redundant Console button.
- Console logo (`Adamas To Aurum`) links to `console.html` so admins stay in the admin dashboard.
- Logout and 401 redirects now go to `/`.
- Headers show only role-appropriate links:
  - Logged-out: Sign In
  - Player: Events, Collection, Battle
  - Admin/Author: Console

### 4. Test accounts
- Added a seeded test player in `app/src/backend/db/seed.sql`.
- Documented test accounts in `README.md`.

| Account | Username | PIN | Role | Landing page |
|---|---|---|---|---|
| Alice (admin) | `alice@example.com` | `1234` | Super admin | Console |
| Test Player | `player@example.com` | `1234` | Player | Events |

### 5. Live event sync for players
- Player map (`index.html` / `events.html`) now refreshes automatically:
  - Polls `/api/events` every 30 seconds.
  - Refreshes immediately when the tab becomes visible again (`visibilitychange`).
  - Fetches with `cache: 'no-store'` to avoid stale responses.
  - Clears old markers before re-rendering new ones.

## AI assistance declaration

This work was implemented by the project author with assistance from **Qoder**, an AI coding assistant. Qoder helped with:

- Designing the consolidated login flow and role-based redirect logic.
- Writing and editing frontend and backend code in the files listed above.
- Debugging redirect, navigation, and stale-map-data issues.
- Creating the seeded test player account and documenting test credentials in `README.md`.
- Running the frontend and backend test suites to verify the changes.

All final decisions, review, and approval of the changes were made by the project author.
