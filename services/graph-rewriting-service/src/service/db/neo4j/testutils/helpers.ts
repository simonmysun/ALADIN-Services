import { Session } from 'neo4j-driver';

export const getAllNodes = async function (session: Session) {
	return await session.run(`MATCH (n) RETURN n`);
};

export const getAllEdges = async function (session: Session) {
	return await session.run(`MATCH (n)-[r]->(m) RETURN r`);
};

export const getApocJsonAllExport = async function (session: Session) {
	return session.run(
		`CALL apoc.export.json.all(null, {useTypes:true, stream: true}) \
			YIELD file, nodes, relationships, properties, data \
			RETURN file, nodes, relationships, properties, data`
	);
};
