import 'dotenv/config'
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '127.0.0.1',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'a2adb', 
  port:     Number(process.env.DB_PORT) || 3306, 
  ssl:      process.env.DB_SSL === 'true'
              ? { rejectUnauthorized: false }
              : false,
  waitForConnections: true,
  connectionLimit:    10,
})

export default pool