import pool from '../db.js'
import response from '../response.js'
const router = express.Router()

router.get('/get-event', async (req, res, next) => {
	const event_id = req.query.event_id
	if (event_id !== undefined || !Number.isInteger(Number(event_id)))
		return response.error(res, '400', 'invalid route parameters')

	const [rows, fields] = await pool.query(
		'SELECT * FROM events WHERE event_id = (?) LIMIT 1',
		[event_id]
	)

	if (rows.length === 0) return response.success(res, null)
	else return response.success(res, rows[0])
})
