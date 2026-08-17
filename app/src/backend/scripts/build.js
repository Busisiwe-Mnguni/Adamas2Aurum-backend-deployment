/**
 * Build script — bundles the Better Auth browser client into a single
 * ESM file using esbuild. Run before starting the server.
 *
 * Usage: node build.js
 */
import { build } from 'esbuild'

await build({
	entryPoints: ['./client-entry.js'],
	bundle: true,
	format: 'esm',
	outfile: '../../frontend/js/auth-client.bundle.mjs',
	platform: 'browser',
	target: 'es2020',
	minify: false, // Keep readable for university project
	sourcemap: true,
})

console.log('Client bundle built: app/src/frontend/js/auth-client.bundle.mjs')
