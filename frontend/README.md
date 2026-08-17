# Live Map (no hardcoded values, free)

A real, pannable/zoomable map — like Google Maps, but using free
OpenStreetMap tiles via Leaflet.js — showing your live position via the
browser's built-in Geolocation API.

- No API key, no billing (OpenStreetMap tiles are free for reasonable use).
- No hardcoded coordinates or events — the marker moves to wherever your
  browser reports.

## Run it
```bash
npm install
npm start
```
Open `http://localhost:3000` and allow location access when prompted.

Since you're testing away from campus, this will just center on and
follow wherever you actually are — that's expected, it's not
campus-specific in any way. When you're back on campus it'll show your
real position there.

## Notes
- `watchPosition` keeps updating the marker and a shaded "accuracy
  radius" circle as your device gets new fixes.
- The map auto-centers on your position on the first fix only, so you
  can freely pan/zoom afterward without it snapping back.
- OpenStreetMap's public tile server (`tile.openstreetmap.org`) is meant
  for light/dev use — if you ever deploy this for real users at scale,
  their usage policy asks you to switch to a provider with a proper tile
  hosting plan (several have free tiers, e.g. MapTiler, Stadia Maps).
