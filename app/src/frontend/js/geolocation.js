// returns: [latitude, longitude]
export function get_player_location() {
	return new Promise((resolve, reject) => {
		if (!navigator.geolocation) {
			reject(new Error('Geolocation not supported'))
			return
		}
		navigator.geolocation.getCurrentPosition(
			(geo) => {
				// returns a GeolocationCoordinates object
				// Source: 'https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates'
				resolve([geo.coords.latitude, geo.coords.longitude])
			},
			(geo_error) => {
				reject(
					new Error(
						`Failed to get current player location (${geo_error.code})`
					)
				)
			},
			{ enableHighAccuracy: true, timeout: 10000 }
		) // 10000ms = 10secs
	})
}
