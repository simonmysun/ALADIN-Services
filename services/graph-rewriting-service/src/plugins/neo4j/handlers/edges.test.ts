import { FastifyReply, FastifyRequest } from 'fastify';
import { expect, test, describe, vi, afterEach, beforeEach } from 'vitest';

import {
	GraphEdgeSchema,
	GraphEdgeSchema as GraphEdgeSchemaInterface,
} from '../../../types/edge.schema';
import { Neo4jGraphService } from '../../../service/db/neo4j/graph.service';

import {
	createEdgeHandler,
	getEdgeHandler,
	deleteEdgeHandler,
	ISingleEdgeParams,
} from './edges';

import {
	createdReply,
	deletedReply,
	notFoundReply,
	okReply,
} from '../../../utils/response';

vi.mock('../../../service/graph/neo4j/graph.service');
vi.mock('../../../utils/response');

describe('Tests node route handlers', () => {
	let mockReply: FastifyReply;
	let mockRequest: FastifyRequest;

	beforeEach(() => {
		mockReply = {
			send: vi.fn(),
		} as unknown as FastifyReply;

		mockRequest = {
			dbGraphService: {
				createEdge: vi.fn(),
				getEdge: vi.fn(),
				deleteEdge: vi.fn(),
			} as unknown as Neo4jGraphService,
		} as unknown as FastifyRequest;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test('Test createNode', async () => {
		const body: GraphEdgeSchema = {
			source: 'testKeyA',
			target: 'testKeyB',
			key: 'testEdge',
			attributes: { label: 'testLabel' },
		};
		mockRequest.body = body as GraphEdgeSchemaInterface;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.createEdge = vi.fn().mockResolvedValue(body);

		await createEdgeHandler(
			mockRequest as FastifyRequest<{ Body: GraphEdgeSchemaInterface }>,
			mockReply
		);

		expect(mockRequest?.dbGraphService?.createEdge).toHaveBeenCalledWith(
			body.source,
			body.target,
			body.key,
			body.attributes
		);
		expect(createdReply).toHaveBeenCalledWith(mockReply, body);
	});

	test('Test getEdge', async () => {
		const params: ISingleEdgeParams = { edgeInternalId: 'testKey' };
		mockRequest.params = params;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		const returnValue = {
			source: 'testKeyA',
			target: 'testKeyB',
			key: 'testEdge',
			attributes: { label: 'testLabel' },
		};
		mockRequest.dbGraphService.getEdge = vi.fn().mockResolvedValue(returnValue);

		await getEdgeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleEdgeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.getEdge).toHaveBeenCalledWith(
			params.edgeInternalId
		);
		expect(okReply).toHaveBeenCalledWith(mockReply, returnValue);
	});

	test('Test getEdge returning 404 if no node returned', async () => {
		const params: ISingleEdgeParams = { edgeInternalId: 'unknownTestId' };
		mockRequest.params = params;

		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.getEdge = vi.fn().mockResolvedValue(undefined);

		await getEdgeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleEdgeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.getEdge).toHaveBeenCalledWith(
			params.edgeInternalId
		);
		expect(notFoundReply).toHaveBeenCalledWith(mockReply, 'Edge not found');
	});

	test('Test deleteEdge', async () => {
		const params: ISingleEdgeParams = { edgeInternalId: 'testId' };
		mockRequest.params = params;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.deleteEdge = vi.fn();

		await deleteEdgeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleEdgeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.deleteEdge).toHaveBeenCalledWith(
			params.edgeInternalId
		);
		expect(deletedReply).toHaveBeenCalledWith(mockReply);
	});

	test.todo('Test deleteEdge failed for unkown nodeId');
});
