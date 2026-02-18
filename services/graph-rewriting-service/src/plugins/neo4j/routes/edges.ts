import { FastifyInstance } from 'fastify';

import GraphEdgeSchema from '../../../schemas/edge.schema.json';
import { GraphEdgeSchema as GraphEdgeSchemaInterface } from '../../../types/edge.schema';
import {
	createEdgeHandler,
	getEdgeHandler,
	deleteEdgeHandler,
	// getAllEdgesHandler,
	// deleteAllEdgesHandler,
	ISingleEdgeParams,
} from '../handlers/edges';

export default async function routes(fastify: FastifyInstance) {
	fastify.post<{ Body: GraphEdgeSchemaInterface }>(
		'/edge',
		{ schema: { body: GraphEdgeSchema } },
		createEdgeHandler
	);

	fastify.get<{ Params: ISingleEdgeParams }>(
		'/edge/:edgeInternalId',
		getEdgeHandler
	);

	fastify.delete<{ Params: ISingleEdgeParams }>(
		'/edge/:edgeInternalId',
		deleteEdgeHandler
	);

	// fastify.get('/edges', getAllEdgesHandler);
	// fastify.delete('/edges', deleteAllEdgesHandler);
}
