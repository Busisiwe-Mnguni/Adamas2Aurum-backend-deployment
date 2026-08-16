import express from 'express'

import pool from './utils/db.js'
import event_routes from './routes/events.js'
import { execute_sql_script } from './utils/sql_utils.js'

const app = express()
const PORT = process.env.PORT || 8024

app.use(express.json())

app.use('/events', event_routes)

app.get('/api/health', async (req, res) => {
	try {
		const [rows] = await pool.query('SHOW TABLES')

		res.json({
			success: true,
			tables: rows,
		})
	} catch (error) {
		console.error('Database connection failed:', error)

		res.status(500).json({
			success: false,
			database: false,
		})
	}
})

try {
	await execute_sql_script(pool, './db/schema.sql')
	await execute_sql_script(pool, './db/seed.sql')
} catch (err) {
	console.error('failed to run sql scripts')
}

try {
	console.log(await pool.query('SELECT NOW() as currentTime;'))
	console.log(await pool.query('SHOW DATABASES;'))
	console.log(await pool.query('SHOW TABLES FROM testdb;'))
} catch (err) {
	console.error('failed to run sql statements to understand db structure')
	console.error('error: ', err)
}

app.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
})
