/**
 * Loads .env from the project root (two levels above this file).
 * Must be imported BEFORE any module that reads process.env at import time.
 * Adapted from feat/user-story-1-auth.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '..', '..', '.env')
dotenv.config({ path: envPath })
