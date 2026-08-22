import express from 'express'

import pool from '../utils/db.js'
import { error, success } from '../utils/response.js'
import { validUserCards, getActiveBattle, TURN_TIMEOUT_MS } from '../utils/battle.js'

const router = express.Router()

router.use((req, res, next) => {
	console.log(
		`[Cards Router Log] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}`
	)
	next()
})

function requireAuth(req, res, next) {
	if (!req.user?.user_id) {
		return res
			.status(401)
			.json({ error: 'Unauthorised — please log in' })
	}
	next()
}

async function startNPCBattle(req, res) {
	try {
		const [result] = await pool.query(
			`INSERT INTO battles (
				player1_id, player2_id,
				winner_id,
				status,
				started_at,
				ended_at
			) VALUES (
				?, NULL,
				NULL,
				'ACTIVE',
				CURRENT_TIMESTAMP,
				NULL
			)`,
			[req.user.user_id]
		)
		if (result.affectedRows == 0)
			return error(res, 500, 'Failed to start battle')
		success(res, result.affectedRows)
	} catch (err) {
		console.error(err)
		error(res, 500, 'Failed to start battle')
	}
}

router.get('/start-battle', requireAuth, async (req, res, next) => {
	try {
		if ((await getActiveBattle(req.user)) != null)
			return error(res, 500, 'Already in a battle')
		if (req.query.npc) return startNPCBattle(req, res)
		else return error(res, 500, 'Unfinished route')
	} catch (err) {
		console.error(err)
		error(res, 500, err.message)
	}
})

router.post('/build-battle-deck', requireAuth, async (req, res, next) => {
	try {
		const battle_id = await getActiveBattle(req.user)
		if (battle_id == null) return error(res, 500, 'Not in a battle')
		var deck = req.body
		if (!(await validUserCards(req.user, deck)) || deck.length != 5)
			error(
				res,
				500,
				'Failed to build battle deck due to invalid card selection'
			)

		const values = []
		const placeholders = deck
			.map((card, idx) => {
				values.push(
					battle_id,
					req.user.user_id,
					card.card_id,
					idx
				)
				return '(?,?,?,?)'
			})
			.join(',')
		const [result] = await pool.query(
			`INSERT INTO battle_decks
			(battle_id, user_id, card_id, slot_position) VALUES
			${placeholders}
			`,
			values
		)
		if (result.affectedRows != 5)
			error(res, 500, 'Failed to build deck')
		success(res, result.affectedRows)
	} catch (err) {
		console.error(err)
		error(res, 500, err.message)
	}
})

export default router
