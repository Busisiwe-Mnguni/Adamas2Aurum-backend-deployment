import express from 'express'

import pool from '../utils/db.js'
import { error, success } from '../utils/response.js'

const router = express.Router()

router.get('/get-event', async (req, res, next) => {
	const event_id = req.query.event_id
	if (event_id !== undefined || !Number.isInteger(Number(event_id)))
		return error(res, 400, 'invalid route parameters')

	const [rows, fields] = await pool.query(
		'SELECT * FROM events WHERE event_id = (?) LIMIT 1',
		[event_id]
	)

	if (rows.length === 0) return error(res, 404, 'event does not exist')
	else return success(res, rows[0])
})

export default router
