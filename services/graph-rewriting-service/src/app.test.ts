import { expect, test, describe } from 'vitest';

import { buildServer } from './app';

describe('Test Fastify Server', () => {
	test('Request existing route', async () => {
		const fastify = buildServer();

		const response = await fastify.inject({
			method: 'GET',
			url: '/health',
		});

		expect(response.statusCode).toBe(200);
		expect(response.body).toBe(JSON.stringify({ hello: 'fastify server' }));

		fastify.close();
	});

	test('Request undefined route', async () => {
		const fastify = buildServer();

		const response = await fastify.inject({
			method: 'GET',
			url: '/notexisting',
		});

		expect(response.statusCode).toBe(404);
		expect(response.body).toBe(
			JSON.stringify({
				message: 'Route GET:/notexisting not found',
				error: 'Not Found',
				statusCode: 404,
			})
		);

		fastify.close();
	});
});
