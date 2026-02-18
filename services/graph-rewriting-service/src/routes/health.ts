import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const healthcheck = (
	request: FastifyRequest,
	reply: FastifyReply
): FastifyReply => {
	return reply.code(200).send({ hello: 'fastify server' });
};

export default function routes(fastify: FastifyInstance) {
	fastify.get('/health', healthcheck);
}
