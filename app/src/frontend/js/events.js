import { distance } from '../utils/general.js'
import { get_player_location } from '../utils/geolocation.js'

function get_event_location(game_event) {
	return [game_event.latitude, game_event.longitude]
}

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
