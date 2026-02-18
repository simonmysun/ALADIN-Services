import { FastifyBaseLogger } from 'fastify';
// @ts-expect-error abstract-logging has no types
import nullLogger from 'abstract-logging';

class Logger {
	private instance: FastifyBaseLogger = nullLogger;

	constructor() {
		this.instance = nullLogger;
	}

	init(fastifyLogger: FastifyBaseLogger) {
		this.instance = fastifyLogger;
	}

	info(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.info(obj, msg, ...args);
	}
	error(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.error(obj, msg, ...args);
	}
	fatal(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.fatal(obj, msg, ...args);
	}
	warn(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.warn(obj, msg, ...args);
	}
	debug(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.debug(obj, msg, ...args);
	}
	trace(obj: object | unknown, msg?: string, ...args: string[]) {
		this.instance?.trace(obj, msg, ...args);
	}
}

export const logger = new Logger();
