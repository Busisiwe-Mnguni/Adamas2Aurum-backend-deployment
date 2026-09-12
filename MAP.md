# Wits Quest — Map System

Pokémon GO-style live world map for the Wits Quest campus game (University
of the Witwatersrand, Braamfontein). Players roam a gamified world map;
tappable event stops live at Wits; challenge attempts are gated to players
physically on campus.

## Architecture

- **Renderer:** MapLibre GL JS (CDN, v3.6.2), no API key.
- **Basemap:** CartoDB Voyager **vector** tiles (whole world, live OSM
  data), restyled in code to a PoGO look — green base, parks, water, muted
  extruded buildings, asphalt roads with solid yellow edge lines, zero
  street-name/POI labels. All gameplay information lives on markers, never
  in the tiles.
- **Single source of style truth:** `app/src/frontend/js/campus-style.js`
  (`createCampusStyle()`, camera constants, geofence bounds/helpers,
  day/night theme engine). All map pages import from it.

## Pages

| Page | File | Role |
|---|---|---|
| Main game map | `app/src/frontend/index.html` + `js/main.js` | GPS avatar, stops, geofence, trivia modals, HUD |
| 2D preview | `app/src/frontend/pages/map.html` | World overview + event pins, no GPS |
| Events | `app/src/frontend/pages/events.html` + `js/events.js` | Sidebar list, range pills, challenge/QR flow |

## Data flow (no static campus file)

- `campus.geojson` is **retired as a render source** — neither copy
  (`app/src/frontend/public/`, `app/src/backend/`) is fetched or drawn.
  Kept for reference/future use only.
- **Event stops:** coordinates + metadata come from the backend
  (`GET /api/events`), with a hardcoded 6-stop fallback when offline.
- **Off-campus fact stops:** queried live from the already-loaded vector
  tiles (`poi` layer, name required, max 12 in view, zoom ≥ 15.5).
- **Proximity radii:** GeoJSON built at runtime from event coordinates —
  the only GeoJSON the client creates.

## Gameplay systems

- **Player avatar:** continuous GPS `watchPosition`, blue dot + accuracy
  circle, compass/GPS heading wedge, idle/walk animation, fading breadcrumb
  trail. WASD walks a demo avatar; simulate on/off-campus buttons aid
  desktop testing.
- **Geofence:** rectangular bbox around Braamfontein
  (lon 28.017–28.050, lat −26.198––26.173) decides on/off-campus.
  Off-campus players browse freely with an info banner; tapping a stop
  shows *"You need to be on Wits campus"* instead of starting trivia.
  (Known limitation: bbox, not a true campus polygon.)
- **Day/night:** real-time theme blended from the device clock (dark navy
  night palette, dimmed fog/clouds, smooth dawn/dusk transitions),
  re-applied every 60s. Covered by `daynight.test.js`.
- **Camera:** street-level lock (zoom 17–20, pitch 55–70°), PoGO-style
  follow with drag-to-free-look, 🎯 recenter, idle pull-back to campus.

## Tuning guide (where things live)

- Map colors/roads/labels/camera limits → `campus-style.js`
- Day/night schedule + palettes → `nightFactorAt()` / `DAY_NIGHT_LAYERS`
  in `campus-style.js`
- Stop look/animations → `index.html` (`stop-cube`, `stop-ring`, …)
- Challenge gating message → `handleChallengeAttempt()` in `main.js`;
  events-page variant → `buildPopupHTML()` in `events.js`
- HUD copy/panels → inline `<style>`/markup in each page

## History (how it got here)

Leaflet defaults → static Overpass GeoJSON baked into the style →
MapLibre + night theme → PoGO daylight → whole-world vector tiles →
reference-driven polish (lane markings, fog, clouds, glow) → off-campus
fact stops → day/night cycle → PokéStop cube markers. A Three.js 3D
prototype was built along the way and scrapped; all traces removed.

## Verification

`node --experimental-vm-modules node_modules/.bin/jest` — 17 tests
green (location, day/night schedule, backend services); all touched files
pass `prettier --check` and `node --check`.
