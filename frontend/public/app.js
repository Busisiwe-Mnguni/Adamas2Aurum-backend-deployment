// app.js — real, pannable/zoomable map (OpenStreetMap tiles via Leaflet,
// free, no API key) with your live position from the browser's built-in
// Geolocation API. No hardcoded coordinates — everything comes from
// navigator.geolocation.

const statusEl = document.getElementById('status');

// Start the map centered on (0,0) — it will re-center on your real
// position as soon as the first location fix comes in.
const map = L.map('map').setView([0, 0], 2);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19,
}).addTo(map);

let marker = null;
let accuracyCircle = null;
let hasCentered = false;

function updatePosition(position) {
  const { latitude, longitude, accuracy } = position.coords;
  const latLng = [latitude, longitude];

  if (!marker) {
    marker = L.marker(latLng).addTo(map).bindPopup('You are here');
    accuracyCircle = L.circle(latLng, {
      radius: accuracy,
      color: '#2f6fed',
      fillColor: '#2f6fed',
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);
  } else {
    marker.setLatLng(latLng);
    accuracyCircle.setLatLng(latLng);
    accuracyCircle.setRadius(accuracy);
  }

  if (!hasCentered) {
    map.setView(latLng, 17);
    hasCentered = true;
  }

  statusEl.textContent = `Accuracy: ~${Math.round(accuracy)} m`;
}

function handleError(err) {
  console.error('Geolocation error:', err);
  statusEl.textContent =
    err.code === err.PERMISSION_DENIED
      ? 'Location permission denied — enable it in your browser to see your position.'
      : 'Could not get your location.';
}

if ('geolocation' in navigator) {
  navigator.geolocation.watchPosition(updatePosition, handleError, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 10000,
  });
} else {
  statusEl.textContent = 'Geolocation is not supported by this browser.';
}
