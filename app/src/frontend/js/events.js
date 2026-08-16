import { api_url } from './constants.js'
import { distance } from './general.js'
import { get_player_location } from './geolocation.js'

function get_event(event_id) {
	return fetch(`${api_url}/events/get-event?event_id=${event_id}`)
		.then(async (res) => {
			if (!res.ok) {
				const err = await res.json()
				console.error(`error ${res.status}: `, err)
				return null
			}
			const data = await res.json()
			return data
		})
		.catch((err) => {
			console.error('error: ', err)
			return null
		})
}

// returns: [latitude, longitude]
function get_event_location(game_event) {
	return [game_event.latitude, game_event.longitude]
}

// returns: true or false
async function get_player_event_eligibality(game_event) {
	try {
		var player_loc = await get_player_location()
		var event_loc = get_event_location(game_event)

		var d = distance(
			player_loc[0],
			player_loc[1],
			event_loc[0],
			event_loc[1]
		)

		if (d < game_event.radius_meters) return true
		else return false
	} catch (err) {
		return false
	}
}
