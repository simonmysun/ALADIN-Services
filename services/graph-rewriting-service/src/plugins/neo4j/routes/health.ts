import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { okReply } from '../../../utils/response';

const healthcheck = async (
	request: FastifyRequest,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const session = request.neo4j;

	if (session) {
		return okReply(reply, {});
	}

	throw Error('Neo4j session not found');
};

export default async function routes(fastify: FastifyInstance) {
	fastify.get('/health', healthcheck);
}
