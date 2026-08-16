import express from 'express'
import cors from 'cors'
import path from 'path'

import pool from './utils/db.js'
import event_routes from './routes/events.js'
import { execute_sql_script } from './utils/sql_utils.js'

const app = express()
app.use(cors())

const PORT = process.env.PORT || 3000

async function initialize_database() {
	await execute_sql_script(pool, './db/schema.sql')
}

async function seed_database() {
	await execute_sql_script(pool, './db/seed.sql')
}

async function view_database() {
	console.log(await pool.query('SELECT NOW() as currentTime;'))
	console.log(await pool.query('SHOW DATABASES;'))
	console.log(await pool.query('SHOW TABLES FROM testdb;'))
}

app.use(express.json())

app.use('/api/events', event_routes)

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
	await initialize_database()
	await seed_database()
	await view_database()
} catch (err) {
	console.error('error: ', err.message)
}

app.listen(PORT, () => {
	console.log(`A2A backend running on port ${PORT}`)
})
