# Handoff: Wits Quest — Campus Map Design

**Scope note:** by the user's explicit instruction, this thread has only been working on the **map visual design**. The game systems described in the project brief (proximity triggers, trivia engine, card collection, turn-based battles) are **out of scope for now** — do not start designing those unless the user asks.

## Project context

Course project brief ("Project 6: Campus Game - Wit's Quest"): a Pokémon Go–style web game on the real Wits University (Braamfontein) campus. Players near a landmark can trigger a trivia/history minigame; winning awards a collectible card with battle stats, usable in a turn-based battle minigame vs other players or CPUs. **Only the map layer has been worked on so far.**

## Goal for the map

Real Wits campus geography, rendered in a stylized/cartoon "gamey" look (like Pokémon Go's map) — not photorealistic. The user's existing app currently uses Leaflet with a plain/"ugly" default tile look and wants to replace it.

## Data pipeline (how we got the geometry)

1. User exported real campus OSM data via **Overpass Turbo** (overpass-turbo.eu) using a query for `building`, `highway`, and `leisure` tags around Wits.
2. First export (`/mnt/user-data/uploads/export.geojson`) covered the whole Wits area, possibly including Parktown/Medical campus — **broader than needed**, since the game itself is scoped to Braamfontein (East + West campus, split by the M1).
3. **Current ask from user**: re-run Overpass with the view zoomed/panned to just Braamfontein before exporting, using this query so it only grabs what's on screen:
      ```
      [out:json][timeout:25][bbox:{{bbox}}];
      (
        way["building"];
        relation["building"];
        way["highway"];
        way["leisure"];
      );
      out geom;
      ```
      **This tighter Braamfontein-only export has not yet been uploaded/processed.** Next agent: if the user provides a new export file, re-run the same enrichment pipeline (below) on it in place of the old one.

## Enrichment pipeline (applied to whatever export.geojson is current)

A Python script adds two properties to each feature so the style can consume them directly:

- `render_height` (buildings only): uses real OSM `height` tag if present, else `building:levels * 3.2`, else a deterministic pseudo-random fallback (hash of `@id`) so heights vary but stay consistent across reloads.
- `render_color`: assigned per feature type (see "Style decisions" below for the current color logic — it changed between v1 and v2).

Output has been saved as `campus.geojson` (v1 palette) and `campus_v2.geojson` (v2 palette, current best version). Regenerate similarly for any new Braamfontein-only export.

## Style decisions — version history

- **v1** (`style.json`, `wits-campus-map.html`): 8-color rotating "candy" palette per building, feedback from user: **rejected as "ugly," clashes with app**.
- **v2** (`wits-quest-map-v2.html`, uses `campus_v2.geojson` inline): user's actual complaint was diagnosed as too many colors / no cohesion, not the cartoon-extrusion concept itself. Fix applied:
     - Only **2 muted tones** (`#F4EBDD` / `#E9DCC3`, cream/sandstone) for ordinary background buildings.
     - **1 accent color** (`#1F4E8C`, Wits blue) reserved _only_ for **named buildings** — this conveniently makes likely quest/landmark sites visually distinct from filler scenery for free.
     - Added MapLibre `light` block + `fill-extrusion-vertical-gradient: true` on the building layer so buildings get a real shaded gradient (top-to-bottom), which reads as "toy/cartoon" rather than flat polygon fills.
     - Softer/muted ground colors throughout (sage green background, muted sage for fields, tan/grey for paths vs roads).
     - **As of this handoff, the user has not yet confirmed whether v2 solves the "ugly" complaint** — this was the last thing shown before the conversation moved to writing this handoff doc. First thing next agent should do: ask for feedback on v2, or look for feedback already given later in the conversation.

## Files currently in `/mnt/user-data/outputs/`

| File                                                                                                        | Purpose                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `campus.geojson`                                                                                            | v1 enriched geojson (candy palette) — superseded                                                                                       |
| `style.json`                                                                                                | Standalone MapLibre style spec for v1 — superseded, kept for reference on structure                                                    |
| `README.md`                                                                                                 | Original integration notes (Mapbox/MapLibre wiring, `maxBounds`, migration snippet from Leaflet) — still generally accurate            |
| `wits-campus-map.html`                                                                                      | v1 live preview artifact — superseded by v2                                                                                            |
| `campus_v2.geojson` _(only exists in `/home/claude/wits-map/`, not yet copied to outputs — copy if needed)_ | v2 enriched geojson, current palette                                                                                                   |
| `wits-quest-map-v2.html`                                                                                    | **Current best version** — live interactive preview, self-contained (geojson embedded inline, MapLibre GL JS via CDN, no API key/cost) |

## Known open items for next agent

1. Get user's reaction to v2 style — iterate further if still not right. Possible next directions if so: try an even more muted/pastel "Alto's Odyssey"-style palette, or a per-faculty color-coding scheme (mentioned as an option earlier but not yet built) instead of the landmark/background split.
2. Swap in the tighter Braamfontein-only Overpass export once the user provides it (see pipeline above) — current data may still include buildings outside actual gameplay bounds.
3. `maxBounds` in the live preview (`[[28.0170,-26.1980],[28.0500,-26.1730]]`) was eyeballed from the original wider export's bbox — tighten this once the Braamfontein-only data is in.
4. 59 of 121 buildings in the current data have no `name` tag (so they render in the plain background color, not the landmark accent) — fine for scenery, but if the user wants specific unnamed buildings treated as quest landmarks, those will need manual naming/tagging.
5. Nothing on proximity detection, trivia, cards, or battle system has been started — see "Scope note" above.

## Tech stack used so far

- **MapLibre GL JS** (v3.6.2, via cdnjs) — chosen over Leaflet for 3D building extrusion support; chosen over CesiumJS/Google Photorealistic 3D Tiles because the user wants a cartoon/stylized look, not photorealism, and this avoids an API key + billing dependency.
- No backend/server code has been touched — this has all been static data + a static HTML preview.
