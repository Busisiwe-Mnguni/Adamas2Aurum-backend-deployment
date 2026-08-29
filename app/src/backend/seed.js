import 'dotenv/config'
import pool from './utils/db.js'
import { execute_sql_script } from './utils/sql_utils.js'

// Run explicitly with: npm run db:seed
// Truncates and re-inserts all seed data. Do NOT run this while teammates
// are actively testing against the shared dev database — it wipes
// user accounts, points, trivia attempts, etc. Coordinate in the team
// chat before running against the shared Aiven instance.

async function main() {
	console.log('======\nSeeding DB tables\n======')
	let ret = await execute_sql_script(pool, './db/seed.sql')
	if (ret.ok === false)
		throw new Error(ret.error)
	console.log('======\nDone.\n======')
	process.exit(0)
}

main().catch((err) => {
	console.error('Seeding failed:', err.message)
	process.exit(1)
})
