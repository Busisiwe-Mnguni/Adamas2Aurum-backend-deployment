// Source: 'https://en.wikipedia.org/wiki/Haversine_formula'
// returns: distance between two points in meters
function calculate_haversine_distance(lat1, lon1, lat2, lon2) {
	const R = 6371000
	const to_radians = (degree) => (degree * Math.PI) / 180

	const d_lat = to_radians(lat2 - lat1)
	const d_lon = to_radians(lon2 - lon1)

	const r_lat1 = to_radians(lat1)
	const r_lat2 = to_radians(lat2)

	// Haversine formula
	const a =
		Math.pow(Math.sin(d_lat / 2), 2) +
		Math.sin(d_lon / 2) *
			Math.sin(d_lon / 2) *
			Math.cos(r_lat1) *
			Math.cos(r_lat2)

	const c = 2 * Math.asin(Math.min(1, Math.sqrt(a)))

	return R * c
}

export function distance(loc1, loc2) {
	return calculate_haversine_distance(
		loc1.latitude,
		loc1.longitude,
		loc2.latitude,
		loc2.longitude
	)
}
