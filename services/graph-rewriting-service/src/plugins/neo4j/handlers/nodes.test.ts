import { FastifyReply, FastifyRequest } from 'fastify';
import { expect, test, describe, vi, afterEach, beforeEach } from 'vitest';

import {
	GraphNodeSchema,
	GraphNodeSchema as GraphNodeSchemaInterface,
} from '../../../types/node.schema';
import { Neo4jGraphService } from '../../../service/db/neo4j/graph.service';

import {
	createNodeHandler,
	getNodeHandler,
	getAllNodesHandler,
	deleteNodeHandler,
	deleteAllNodesHandler,
	ISingleNodeParams,
} from './nodes';

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
				createNode: vi.fn(),
				getNode: vi.fn(),
				getAllNodes: vi.fn(),
				deleteNode: vi.fn(),
				deleteAllNodes: vi.fn(),
			} as unknown as Neo4jGraphService,
		} as unknown as FastifyRequest;
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	test('Test createNode', async () => {
		const body: GraphNodeSchema = {
			key: 'testKey',
			attributes: { label: 'testLabel' },
		};
		mockRequest.body = body as GraphNodeSchemaInterface;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.createNode = vi.fn().mockResolvedValue({
			key: 'testKey',
			attributes: { label: 'testLabel' },
		});

		await createNodeHandler(
			mockRequest as FastifyRequest<{ Body: GraphNodeSchemaInterface }>,
			mockReply
		);

		expect(mockRequest?.dbGraphService?.createNode).toHaveBeenCalledWith(
			body.attributes,
			body.key
		);
		expect(createdReply).toHaveBeenCalledWith(mockReply, body);
	});

	test('Test getNode', async () => {
		const params: ISingleNodeParams = { nodeInternalId: 'testId' };
		mockRequest.params = params;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.getNode = vi
			.fn()
			.mockResolvedValue({ key: 'testId' });

		await getNodeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleNodeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.getNode).toHaveBeenCalledWith(
			params.nodeInternalId
		);
		expect(okReply).toHaveBeenCalledWith(mockReply, { key: 'testId' });
	});

	test('Test getNode returning 404 if no node returned', async () => {
		const params: ISingleNodeParams = { nodeInternalId: 'unknownTestId' };
		mockRequest.params = params;

		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.getNode = vi.fn().mockResolvedValue(undefined);

		await getNodeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleNodeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.getNode).toHaveBeenCalledWith(
			params.nodeInternalId
		);
		expect(notFoundReply).toHaveBeenCalledWith(mockReply, 'Node not found');
	});

	test('Test getAllNodes', async () => {
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.getAllNodes = vi
			.fn()
			.mockResolvedValue([{ key: 'testKey' }, { key: 'testKey2' }]);

		await getAllNodesHandler(
			mockRequest as FastifyRequest<{ Params: ISingleNodeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.getAllNodes).toHaveBeenCalled();
		expect(okReply).toHaveBeenCalledWith(mockReply, [
			{ key: 'testKey' },
			{ key: 'testKey2' },
		]);
	});

	test('Test deleteNode', async () => {
		const params: ISingleNodeParams = { nodeInternalId: 'testId' };
		mockRequest.params = params;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.deleteNode = vi.fn();

		await deleteNodeHandler(
			mockRequest as FastifyRequest<{ Params: ISingleNodeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.deleteNode).toHaveBeenCalledWith(
			params.nodeInternalId
		);
		expect(deletedReply).toHaveBeenCalledWith(mockReply);
	});

	test.todo('Test deleteNode failed for unkown nodeId');

	test('Test deleteAllNodes', async () => {
		const params: ISingleNodeParams = { nodeInternalId: 'testId' };
		mockRequest.params = params;

		// Ensure neo4jGraphService is not null
		if (!mockRequest.dbGraphService) {
			throw new Error('neo4jGraphService is null');
		}

		mockRequest.dbGraphService.deleteAllNodes = vi.fn();

		await deleteAllNodesHandler(
			mockRequest as FastifyRequest<{ Params: ISingleNodeParams }>,
			mockReply
		);

		expect(mockRequest.dbGraphService.deleteAllNodes).toHaveBeenCalled();
		expect(deletedReply).toHaveBeenCalledWith(mockReply);
	});
});
