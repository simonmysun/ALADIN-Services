import { FastifyReply, FastifyRequest } from 'fastify';

import { GraphNodeSchema as GraphNodeSchemaInterface } from '../../../types/node.schema';
import {
	createdReply,
	deletedReply,
	notFoundReply,
	okReply,
} from '../../../utils/response';

export interface ISingleNodeParams {
	nodeInternalId: string;
}

export const createNodeHandler = async (
	request: FastifyRequest<{ Body: GraphNodeSchemaInterface }>,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const neo4jGraphService = request.dbGraphService;
	const body = request.body;

	let result = null;
	if (neo4jGraphService) {
		result = await neo4jGraphService.createNode(body?.attributes, body?.key);
	}

	return createdReply(reply, result);
};

export const getNodeHandler = async (
	request: FastifyRequest<{ Params: ISingleNodeParams }>,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const neo4jGraphService = request.dbGraphService;
	const params = request.params;

	let result = null;
	if (neo4jGraphService && params?.nodeInternalId) {
		result = await neo4jGraphService.getNode(params.nodeInternalId);
	}

	if (!result) {
		return notFoundReply(reply, 'Node not found');
	}

	return okReply(reply, result);
};

export const getAllNodesHandler = async (
	request: FastifyRequest,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const neo4jGraphService = request.dbGraphService;

	let result = null;
	if (neo4jGraphService) {
		result = await neo4jGraphService.getAllNodes();
	}

	return okReply(reply, result);
};

export const deleteNodeHandler = async (
	request: FastifyRequest<{ Params: ISingleNodeParams }>,
	reply: FastifyReply
) => {
	const neo4jGraphService = request.dbGraphService;
	const params = request.params;
	if (neo4jGraphService && params?.nodeInternalId) {
		await neo4jGraphService.deleteNode(params.nodeInternalId);
	}

	return deletedReply(reply);
};

export const deleteAllNodesHandler = async (
	request: FastifyRequest,
	reply: FastifyReply
) => {
	const neo4jGraphService = request.dbGraphService;
	if (neo4jGraphService) {
		await neo4jGraphService.deleteAllNodes();
	}

	return deletedReply(reply);
};
