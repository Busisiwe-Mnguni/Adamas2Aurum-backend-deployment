/**
 * Build script — bundles the Better Auth browser client into a single
 * ESM file using esbuild. Run before starting the server.
 *
 * Usage: node scripts/build.js
 */
import { build } from 'esbuild'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

await build({
	entryPoints: [path.join(__dirname, 'client-entry.js')],
	bundle: true,
	format: 'esm',
	outfile: path.join(
		__dirname,
		'..',
		'..',
		'frontend',
		'js',
		'auth-client.bundle.mjs'
	),
	platform: 'browser',
	target: 'es2020',
	minify: false, // Keep readable for university project
	sourcemap: true,
})

console.log('Client bundle built: app/src/frontend/js/auth-client.bundle.mjs')
