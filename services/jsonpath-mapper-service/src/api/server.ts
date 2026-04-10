import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import mapRoutes from './routes/map.js';
import {
	MapperFunctionsSchema,
	MappingElementSchema,
	MappingTemplateSchema,
	MapRequestSchema,
	MapResponseSchema,
	ErrorResponseSchema,
} from './schemas/map.schema.js';

// Version is read from the npm_package_version env var
// (set automatically by `npm start` or via Dockerfile ENV).
const PKG_VERSION = process.env.npm_package_version ?? '0.0.0';
const PKG_DESCRIPTION =
	"A json to json transformation utility with a few nice features to use when translating for example API responses into a domain object for use in your domain-driven JavaScript applications. Can be used in React applications with the 'useMapper' hook.";

/**
 * Creates and configures the Fastify server instance.
 *
 * Plugins registered:
 *  - @fastify/swagger   → generates OpenAPI 3.0 spec at GET /openapi.json
 *  - @fastify/swagger-ui → serves Swagger UI at GET /docs
 *  - mapRoutes          → POST /map and POST /map/async
 */
export async function buildServer() {
	const fastify = Fastify({
		logger: true,
	});

	// ---------------------------------------------------------------------------
	// Register OpenAPI spec generation (@fastify/swagger)
	// ---------------------------------------------------------------------------
	await fastify.register(fastifySwagger, {
		openapi: {
			openapi: '3.0.3',
			info: {
				title: 'jsonpath-mapper API',
				description:
					PKG_DESCRIPTION +
					'\n\n' +
					'This REST API wraps the `jsonpath-mapper` library, exposing its ' +
					'JSON-to-JSON transformation capabilities over HTTP.\n\n' +
					'**Limitations:** Template values that require JavaScript functions ' +
					'(`$formatting`, `$return`, `$disable`) cannot be expressed in a ' +
					'JSON request body. Use the npm library directly for those cases.',
				version: PKG_VERSION,
				contact: {
					url: 'https://github.com/neilflatley/jsonpath-mapper',
				},
				license: {
					name: 'ISC',
				},
			},
			tags: [
				{
					name: 'Mapping',
					description:
						'Endpoints for JSON-to-JSON transformation using declarative mapping templates.',
				},
			],
			components: {
				schemas: {
					// Register shared schemas so they appear in the OpenAPI components
					// section and can be referenced via $ref throughout the spec.
					MapperFunctions: MapperFunctionsSchema,
					MappingElement: MappingElementSchema,
					MappingTemplate: MappingTemplateSchema,
					MapRequest: MapRequestSchema,
					MapResponse: MapResponseSchema,
					ErrorResponse: ErrorResponseSchema,
				},
			},
		},
	});

	// ---------------------------------------------------------------------------
	// Register Swagger UI (@fastify/swagger-ui)
	// ---------------------------------------------------------------------------
	await fastify.register(fastifySwaggerUi, {
		routePrefix: '/docs',
		uiConfig: {
			docExpansion: 'full',
			deepLinking: true,
		},
	});

	// ---------------------------------------------------------------------------
	// Register route handlers
	// ---------------------------------------------------------------------------
	await fastify.register(mapRoutes);

	return fastify;
}
