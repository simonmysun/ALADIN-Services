const CorsOptions = {
	origin: [
		// ? Development environment
		'http://localhost:3000',
		'http://localhost:5173',
		'http://127.0.0.1:5500',
		'http://localhost:8080',
		// * Add Production and Staging URLs here
	],
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	allowedHeaders: 'Content-Type, Authorization',
	credentials: true,
	maxAge: 86400,
};

export { CorsOptions };
