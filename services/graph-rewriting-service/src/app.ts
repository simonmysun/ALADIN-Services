import 'dotenv/config';

import fastify, { FastifyInstance } from 'fastify';
import { Server, IncomingMessage, ServerResponse } from 'http';

import Swagger from '@fastify/swagger';
import SwaggerUI from '@fastify/swagger-ui';

import cors from '@fastify/cors';

import { loggerConfig } from './config/logger';
import { getAppEnvConfig } from './config/env';
import { corsOptions } from './config/cors';

import healthRoutes from './routes/health';

import neo4jConnector from './plugins/neo4j/index';
import grsPlugin from './plugins/grs/index';

import { logger } from './utils/logger';

/**
 * Creates a fastify server instance
 */
export function buildServer(): FastifyInstance {
	const appEnvConfig = getAppEnvConfig();

	const server: FastifyInstance<Server, IncomingMessage, ServerResponse> =
		fastify({
			logger: loggerConfig[appEnvConfig.APP_ENV] ?? false,
			ignoreTrailingSlash: true,
		});

	logger.init(server.log);

	// Setup CORS
	server.register(cors, corsOptions);

	// Setup Swagger / SwaggerUI
	// Access Swagger page through <root-route>/documentation endpoint
	server.register(Swagger);
	server.register(SwaggerUI);

	server.register(healthRoutes);

	// Use neo4j
	server.register(neo4jConnector);
	// Add grs plugin
	server.register(grsPlugin);

	return server;
}
