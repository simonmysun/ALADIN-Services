import { FastifyLoggerOptions } from 'fastify';
import type { EnvVarAppEnvironment } from './env';
import pino from 'pino';
type PinoLoggerOptions = pino.LoggerOptions;

export const loggerConfig: Record<
	EnvVarAppEnvironment,
	boolean | (FastifyLoggerOptions & PinoLoggerOptions)
> = {
	development: {
		level: 'debug',
		transport: {
			target: 'pino-pretty',
			options: {
				colorize: true,
				singleLine: true,
				translateTime: 'HH:MM:ss Z',
				ignore: 'pid,hostname',
			},
		},
	},
	production: false,
	test: false,
};
