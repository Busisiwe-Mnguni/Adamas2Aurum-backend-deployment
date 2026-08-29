import fs from 'fs'
import path from 'path'

export async function execute_sql_script(pool, script_path) {
	var query,idx
	try {
		const queries = fs
			.readFileSync(script_path, 'utf8')
			.split(';')
			.map((query) => query.trim())
			.filter((query) => query.length > 0) // Remove empty lines

		console.log(
			`Executing ${queries.length} queries sequentially...`
		)
		for ([idx, query] of Object.entries(queries)) {
			console.log(
			`Executing query ${Number(idx) + 1} of ${queries.length}`
			)
			await pool.query(query)
		}
		console.log(`"${script_path}" successfully executed!`)
		return {ok: true}
	} catch (error) {
		console.log(query)
		console.error(`"${script_path}" failed:`, error.message)
		return {ok: false, error}
	}
}
