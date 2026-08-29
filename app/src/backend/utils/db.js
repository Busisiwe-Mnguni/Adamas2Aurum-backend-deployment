import 'dotenv/config'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	port: Number(process.env.DB_PORT) || 8024,
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || 'test',
	database: process.env.DB_NAME || 'testdb',
	ssl:
		process.env.DB_SSL === 'true'
			? { rejectUnauthorized: false }
			: false,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
})

if (process.env.LOG_DB === 'true' && process.env.VERBOSE_LOG_DB === 'true') {
	const originalQuery = pool.query.bind(pool)
	const originalExecute = pool.execute.bind(pool)

	pool.query = function (...args) {
		const sql = args[0]
		const values = args[1]
		console.log(
			`[DB Query] Running: ${sql}`,
			values ? `with values: ${JSON.stringify(values)}` : ''
		)

		return originalQuery(...args)
	}

	pool.execute = function (...args) {
		const sql = args[0]
		const values = args[1]
		console.log(
			`[DB Execute] Running: ${sql}`,
			values ? `with values: ${JSON.stringify(values)}` : ''
		)

		return originalExecute(...args)
	}
}

export default pool
