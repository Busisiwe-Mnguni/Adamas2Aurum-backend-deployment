import pool from './db.js'

export const TURN_TIMEOUT_MS = 10 * 1000

export async function valid_user_cards(user, deck) {
	if (!Array.isArray(deck) || deck.length != 5) return false
	var values = []
	const placeholders = deck
		.map((x) => {
			values.push(x.card_id)
			return '?'
		})
		.join(',')
	values.push(user.user_id)

	try {
		const [rows, fields] = await pool.query(
			`SELECT COUNT(DISTINCT uc.card_id) AS count FROM user_cards uc WHERE uc.card_id IN (${placeholders}) AND uc.user_id = ?`,
			values
		)

		if (rows.length == 0 || rows[0].count != deck.length)
			return false
		else return true
	} catch {
		return false
	}
}

export async function get_active_battle(user_id) {
	try {
		const [rows, fields] = await pool.query(
			`SELECT battle_id FROM battles WHERE (player1_id = ? OR player2_id = ?) AND status = 'ACTIVE' LIMIT 1`,
			[user_id, user_id]
		)

		if (rows.length == 0) return null
		else return rows[0].battle_id
	} catch {
		return null
	}
}

export async function abandon_battle(battle_id) {
	try {
		const [rows, fields] = await pool.query(
			`UPDATE battles SET status = 'ABANDONED', winner_id = ?, ended_at = NOW() WHERE battle_id = ?`,
			[null, battle_id]
		)

		if (rows.length == 0) return null
		else return rows[0].affectedRows
	} catch {
		return false
	}
}
