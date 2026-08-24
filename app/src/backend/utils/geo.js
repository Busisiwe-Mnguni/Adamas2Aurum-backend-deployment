/**
 * Calculates the great-circle distance between two lat/lng points using
 * the Haversine formula — the standard way to compute "as the crow flies"
 * distance between two points on a sphere, which is accurate enough for
 * campus-scale distances (a few hundred meters at most).
 *
 * @param {number} lat1 - first point's latitude, in degrees
 * @param {number} lon1 - first point's longitude, in degrees
 * @param {number} lat2 - second point's latitude, in degrees
 * @param {number} lon2 - second point's longitude, in degrees
 * @returns {number} distance in meters
 */
export function distance_meters(lat1, lon1, lat2, lon2) {
  const EARTH_RADIUS_M = 6371000 // mean radius of the Earth, in meters

  const toRad = (deg) => (deg * Math.PI) / 180

  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return EARTH_RADIUS_M * c
}