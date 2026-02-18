const CorsOptions = {
	origin: [
		// ? Development environment
		'http://localhost:3000',
		'http://localhost:5173',
		// * Add Production and Staging URLs here
	],
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	allowedHeaders: 'Content-Type, Authorization',
	credentials: true,
	maxAge: 86400,
};

export { CorsOptions };
