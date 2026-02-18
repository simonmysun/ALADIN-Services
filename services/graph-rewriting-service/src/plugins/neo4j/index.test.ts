import fastify from 'fastify';
import { expect, test, describe, vi, afterEach } from 'vitest';

import neo4j, { Driver } from 'neo4j-driver';
import { getNeo4jEnvConfig } from './env';
import neo4jConnector from './index';

vi.mock('./env', () => {
	return {
		getNeo4jEnvConfig: vi.fn().mockImplementation(() => ({
			NEO4J_URI: 'bolt://localhost:7687',
			NEO4J_USERNAME: 'neo4j',
			NEO4J_PASSWORD: 'test',
		})),
	};
});

vi.mock('neo4j-driver');

describe('Test Neo4j plugin registration', () => {
	afterEach(() => {
		vi.clearAllMocks();
		vi.resetAllMocks();
	});

	test('Test create plugin decorators', async () => {
		const mockDriver: Partial<Driver> = {
			getServerInfo: vi.fn().mockResolvedValue({}),
			session: vi.fn().mockReturnValue({
				close: vi.fn(),
			}),
			close: vi.fn(),
		};
		vi.mocked(neo4j.driver).mockReturnValue(mockDriver as Driver);

		const server = fastify({ ignoreTrailingSlash: true });
		await server.register(neo4jConnector);

		expect(server.neo4j).not.toBe(undefined);
		expect(server.neo4j).toBe(mockDriver);
		expect(server.hasDecorator('neo4j')).toBe(true);
		expect(server.hasRequestDecorator('dbGraphService')).toBe(true);

		server.get('/', async (request) => {
			expect(request.dbGraphService).not.toBe(undefined);
			return { hello: 'world' };
		});

		await server.inject({
			method: 'GET',
			url: '/',
		});

		server.close();
	});

	test('Test error being logged if neo4j env vars not set', async () => {
		const server = fastify({ ignoreTrailingSlash: true, logger: true });

		const logErrorSpy = vi.spyOn(server.log, 'error');
		vi.mocked(getNeo4jEnvConfig).mockImplementation(() => ({
			NEO4J_URI: '',
			NEO4J_USERNAME: '',
			NEO4J_PASSWORD: '',
		}));

		await server.register(neo4jConnector);

		expect(logErrorSpy).toHaveBeenCalledWith(
			'Fastify Neo4j Plugin: Neo4j ENV Vars are not set correctly'
		);
	});

	test('Test decorators not set and error being logged if no neo4j connection', async () => {
		vi.mocked(getNeo4jEnvConfig).mockImplementation(() => ({
			NEO4J_URI: 'bolt://localhost:7687',
			NEO4J_USERNAME: 'neo4j',
			NEO4J_PASSWORD: 'test',
		}));

		vi.mocked(neo4j.driver).mockImplementation(() => {
			throw new Error('Connection error');
		});

		const server = fastify({ ignoreTrailingSlash: true, logger: true });
		const logErrorSpy = vi.spyOn(server.log, 'error');

		await server.register(neo4jConnector);

		expect(server.hasDecorator('neo4j')).toBe(false);
		expect(server.hasRequestDecorator('neo4jGraphService')).toBe(false);

		expect(logErrorSpy).toHaveBeenCalledWith(
			'Fastify Neo4j Plugin: Error connecting to Neo4j database',
			expect.any(Error)
		);
	});
});
