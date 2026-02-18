import { FastifyInstance } from 'fastify';
import { IReply } from '../../../utils/response';

import RequestTransformSchema from '../../../schemas/request-transform.schema.json';
import RequestFindSchema from '../../../schemas/request-find.schema.json';
import { GraphRewritingRequestSchema as GraphTransformRequestSchemaInterface } from '../../../types/request-transform.schema';
import { GraphFindPatternRequestSchema as GraphFindRequestSchemaInterface } from '../../../types/request-find.schema';
import { GraphSchema as GraphSchemaInterface } from '../../../types/graph.schema';
import {
	externalApiExampleHandler,
	findHandler,
	importHostgraph,
	transformHandler,
} from '../handlers/grs';

export default async function routes(fastify: FastifyInstance) {
	fastify.post<{ Body: GraphTransformRequestSchemaInterface }>(
		'/hostgraph',
		{ schema: { body: RequestTransformSchema } },
		importHostgraph
	);

	fastify.post<{
		Body: GraphFindRequestSchemaInterface;
		Reply: IReply<GraphSchemaInterface[]>;
	}>('/find', { schema: { body: RequestFindSchema } }, findHandler);

	fastify.post<{
		Body: GraphTransformRequestSchemaInterface;
		Reply: IReply<GraphSchemaInterface[]>;
	}>(
		'/transform',
		{ schema: { body: RequestTransformSchema } },
		transformHandler
	);

	fastify.post('/example-external-api-result', externalApiExampleHandler);
}
