import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { okReply } from '../../../utils/response';

const healthcheck = async (
	request: FastifyRequest,
	reply: FastifyReply
): Promise<FastifyReply> => {
	const driver = request.server.neo4j;

	if (driver) {
		return okReply(reply, {});
	}

	throw Error('Neo4j driver not found');
};

export default async function routes(fastify: FastifyInstance) {
	fastify.get('/health', healthcheck);
}
