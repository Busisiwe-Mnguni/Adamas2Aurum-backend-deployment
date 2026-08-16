import 'dotenv/config'
import mysql from 'mysql2/promise'
import fs from 'fs'

const pool = mysql.createPool({
	host: process.env.DB_HOST || '127.0.0.1',
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || 'test',
	database: process.env.DB_NAME || 'testdb',
	port: Number(process.env.DB_PORT) || 8024,
	ssl:
		process.env.DB_SSL !== 'true'
			? false
			: { ca: fs.readFileSync('./certs/ca.pem') },
	waitForConnections: true,
	connectionLimit: 10,
})

export default pool
