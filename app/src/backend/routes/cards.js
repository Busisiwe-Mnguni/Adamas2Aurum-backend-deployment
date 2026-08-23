import express from 'express'

import pool from '../utils/db.js'
import { error, success } from '../utils/response.js'
import { valid_user_cards } from '../utils/battle.js'

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

router.post('/valid-cards', requireAuth, async (req, res) => {
	try {
		var deck = req.body
		if (deck.length != 5) success(res, false)
		if (!(await valid_user_cards(req.user, deck)))
			success(res, false)
		success(res, true)
	} catch (err) {
		console.error(err)
		error(res, 500, err.message)
	}
})

router.get('/get-all', requireAuth, async (req, res) => {
	try {
		const [rows, fields] = await pool.query(
			// 'SELECT * FROM cards WHERE EXISTS (SELECT 1 FROM user_cards uc WHERE uc.user_id = ?)',
			'SELECT c.*,uc.quantity FROM cards c JOIN user_cards uc ON c.card_id = uc.card_id WHERE uc.user_id = ?',
			[req.user.user_id]
		)
		success(res, rows)
	} catch (err) {
		console.error(err)
		error(res, 500, err.message)
	}
})

export default router
