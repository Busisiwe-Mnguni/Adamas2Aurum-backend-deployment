import fs from 'fs'
import path from 'path'

export async function execute_sql_script(pool, script_path) {
	var query
	try {
		const queries = fs
			.readFileSync(script_path, 'utf8')
			.split(';')
			.map((query) => query.trim())
			.filter((query) => query.length > 0) // Remove empty lines

		console.log(
			`Executing ${queries.length} queries sequentially...`
		)
		for (query of queries) {
			await pool.query(query)
		}
		console.log(`"${script_path}" successfully executed!`)
	} catch (error) {
		console.log(query)
		console.error(`"${script_path}" failed:`, error.message)
	}
}
