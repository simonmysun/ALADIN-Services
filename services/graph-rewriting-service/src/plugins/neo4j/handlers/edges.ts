import { FastifyReply, FastifyRequest } from 'fastify';

import { GraphEdgeSchema as GraphEdgeSchemaInterface } from '../../../types/edge.schema';
import {
	createdReply,
	deletedReply,
	notFoundReply,
	okReply,
} from '../../../utils/response';

export interface ISingleEdgeParams {
	edgeInternalId: string;
}

export const createEdgeHandler = async (
	request: FastifyRequest<{ Body: GraphEdgeSchemaInterface }>,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const neo4jGraphService = request.dbGraphService;
	const body = request.body;

	let result = null;
	if (neo4jGraphService) {
		result = await neo4jGraphService.createEdge(
			body.source,
			body.target,
			body.key,
			body.attributes || {}
		);
	}

	return createdReply(reply, result);
};

export const getEdgeHandler = async (
	request: FastifyRequest<{ Params: ISingleEdgeParams }>,
	reply: FastifyReply
) => {
	const neo4jGraphService = request.dbGraphService;
	const params = request.params;
	let result = null;
	if (neo4jGraphService && params?.edgeInternalId) {
		result = await neo4jGraphService.getEdge(params.edgeInternalId);
	}

	if (!result) {
		return notFoundReply(reply, 'Edge not found');
	}

	return okReply(reply, result);
};

export const deleteEdgeHandler = async (
	request: FastifyRequest<{ Params: ISingleEdgeParams }>,
	reply: FastifyReply
) => {
	const neo4jGraphService = request.dbGraphService;
	const params = request.params;
	if (neo4jGraphService && params?.edgeInternalId) {
		await neo4jGraphService.deleteEdge(params.edgeInternalId);
	}

	return deletedReply(reply);
};

// TODO: implement
// export const getAllEdgesHandler = async () => {};

// TODO: implement
// export const deleteAllEdgesHandler = async () => {};
