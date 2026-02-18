interface Neo4jEnvConfig {
	NEO4J_URI: string;
	NEO4J_USERNAME: string;
	NEO4J_PASSWORD: string;
}

export function getNeo4jEnvConfig(): Neo4jEnvConfig {
	const { NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD } = process.env as Record<
		string,
		string
	>;

	return {
		NEO4J_URI,
		NEO4J_USERNAME,
		NEO4J_PASSWORD,
	};
}
