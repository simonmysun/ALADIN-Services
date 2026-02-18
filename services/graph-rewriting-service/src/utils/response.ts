import { FastifyReply } from 'fastify';

const enum Status {
	Error = 'error',
	Forbidden = 'forbidden',
	Fail = 'fail',
	Success = 'success',
}

type ResponseCode = 200 | 201 | 204 | 403 | 404 | 500;

export type IReply<Payload> = Record<ResponseCode, ApiResponse<Payload>>;

export interface ApiResponse<Data> {
	status: Status;
	code: ResponseCode;
	message?: string;
	data?: Data;
}

const buildResponseObject = <Data>(
	code: ResponseCode,
	message?: string,
	error?: Error,
	data?: Data
) => {
	let status = Status.Success;

	if (code >= 500 && code <= 599) {
		status = Status.Fail;
	} else if (code >= 400 && code <= 499) {
		if (code === 403) {
			status = Status.Forbidden;
		} else {
			status = Status.Error;
		}
	}

	const responseObject: ApiResponse<Data> = { code, status };

	if (status !== Status.Success && message) {
		responseObject.message = message;
	}

	// if (process.env.NODE_ENV === 'development' && error) {
	// 	data = {
	// 		name: error.name,
	// 		message: error.message,
	// 		stack: error.stack,
	// 	};
	// }

	if (data) {
		responseObject.data = data;
	}

	return responseObject;
};

export const errorReply = (reply: FastifyReply, message: string) => {
	return reply.code(404).send(buildResponseObject(404, message));
};

export const notFoundReply = (reply: FastifyReply, message: string) => {
	return reply.code(404).send(buildResponseObject(404, message));
};

export const createdReply = <Data>(reply: FastifyReply, data: Data) => {
	return reply
		.code(201)
		.send(buildResponseObject(201, undefined, undefined, data));
};

export const deletedReply = (reply: FastifyReply) => {
	// return reply.code(204).send(buildResponseObject(204));
	const returnVal = buildResponseObject(204);
	return reply.code(204).send(returnVal);
};

export const okReply = <Data>(reply: FastifyReply, data: Data) => {
	return reply
		.code(200)
		.send(buildResponseObject(200, undefined, undefined, data));
};
