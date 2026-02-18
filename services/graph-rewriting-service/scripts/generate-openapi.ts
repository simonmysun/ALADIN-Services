/**
 * Generates the OpenAPI spec from the running Fastify app and writes it to
 * openapi.json (and optionally openapi.yaml when --yaml is passed).
 *
 * Usage:
 *   NODE_ENV=test tsx scripts/generate-openapi.ts [--yaml]
 */
import { writeFileSync } from 'fs';
import { buildServer } from '../src/app';

const yaml = process.argv.includes('--yaml');

async function generate() {
	const server = buildServer();

	// ready() triggers all plugin registrations, which causes @fastify/swagger to
	// collect all route schemas. A Neo4j connection error is non-fatal here — the
	// plugin logs the error and continues, so routes and schemas are still registered.
	await server.ready();

	const spec = server.swagger({ yaml });
	const outFile = yaml
		? './graph-rewriting-service.openapi.yaml'
		: './graph-rewriting-service.openapi.json';
	const content = yaml
		? (spec as unknown as string)
		: JSON.stringify(spec, null, 2);

	writeFileSync(outFile, content + '\n');

	await server.close();
	console.log(`OpenAPI spec written to ${outFile}`);
}

generate();
