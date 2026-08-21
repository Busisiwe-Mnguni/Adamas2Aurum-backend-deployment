import 'dotenv/config'
import express from 'express'
import session from 'express-session'
import cors from 'cors'

import pool from './utils/db.js'
import event_routes from './routes/events.js'
import auth_routes from './routes/auth.js'
import trivia_routes from './routes/trivia.js'
import { execute_sql_script } from './utils/sql_utils.js'

const app = express()
const PORT = process.env.PORT || 3000

const allowed_origins = ['http://localhost:8055', 'http://localhost:5173', 'http://127.0.0.1:5173']
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowed_origins.includes(origin)) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        credentials: true,
    })
)

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'a2a-dev-secret',
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            maxAge: 1000 * 60 * 60 * 8,
        },
    })
)

app.use(express.json())

app.use('/api/auth', auth_routes)
app.use('/api/events', event_routes)
app.use('/api/trivia', trivia_routes)

app.get('/api/health', async (req, res) => {
    try {
        const [rows] = await pool.query('SHOW TABLES')
        res.json({ success: true, tables: rows })
    } catch (error) {
        res.status(500).json({ success: false, error: error.message })
    }
})

async function initialize_database() {
    await execute_sql_script(pool, './db/schema.sql')
}

async function seed_database() {
    await execute_sql_script(pool, './db/seed.sql')
}

async function view_database() {
    console.log(await pool.query('SELECT NOW() as currentTime;'))
    console.log(await pool.query('SHOW DATABASES;'))
    console.log(await pool.query('SHOW TABLES FROM a2adb;'))
}

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