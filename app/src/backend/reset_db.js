import pool from './utils/db.js'
import { execute_sql_script } from './utils/sql_utils.js'

async function main() {
	console.log(
		'Resetting DB...\nNote: The DB will be unseeded, so you will have to run the seed script yourself.'
	)
	console.log('======\nDropping DB tables\n======')
	await execute_sql_script(pool, './db/drop_tables.sql')
	console.log('======\nCreating DB tables\n======')
	await execute_sql_script(pool, './db/schema.sql')
	console.log('======\nDone.\nNote: The DB is unseeded. Run the seed script to seed it.\n======')
	process.exit(0)
}

main().catch((err) => {
	console.error('Resetting failed:', err.message)
	process.exit(1)
})
