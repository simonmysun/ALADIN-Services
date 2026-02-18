import {
	ManagedTransaction,
	Session,
	Node,
	Integer,
	Relationship,
	QueryResult,
} from 'neo4j-driver';
import {
	DBGraphEdgeInternalId,
	DBGraphNodeInternalId,
	DBGraphNodeMetadata,
	DBGraphNodeProperties,
	DBGraphNodeResult,
	IGraphDB,
	DBGraphEdgeProperties,
	DBGraphEdgeResult,
	DBGraphEdgeMetadata,
	DBGraphType,
	DBGraphPatternMatchResult,
	DBGraphNACs,
	EdgeUpdateRewriteOptions,
} from '../types';
import {
	computeEdgeQuery,
	computeInjectivityClause,
	computeNacClause,
	computeNodeQuery,
} from './cypher/rewrite';
import { createNodeQuery, updateNodeQuery } from './cypher/base';
import { PatternNodeSchema } from '../../../types/patterngraph.schema';
import { DEFAULT_NODE_LABEL, DEFAULT_RELATIONSHIP_LABEL } from './constants';
import { PatternEdgeSchema } from '../../../types/patternedge.schema';

type Neo4jNode = Node<Integer, DBGraphNodeProperties>;
type Neo4jRelationship = Relationship<Integer, DBGraphEdgeProperties>;

interface Neo4jNodeResult {
	n: Neo4jNode;
}

interface Neo4jRelationshipResult {
	r: Neo4jRelationship;
}

type Neo4jPatternMatchResult = Record<
	string,
	Neo4jRelationship | Neo4jNodeResult
>;

type Neo4jCreateNodeResult = Neo4jNodeResult;
type Neo4jUpdateNodeResult = Neo4jNodeResult;
type Neo4jGetNodesResult = Neo4jNodeResult;

type PatternNodeMetadata = Exclude<PatternNodeSchema['attributes'], undefined>;

export class Neo4jGraphService implements IGraphDB {
	private defaultNodeLabel = DEFAULT_NODE_LABEL;
	private defaultRelationshipLabel = DEFAULT_RELATIONSHIP_LABEL;

	constructor(private readonly session: Session) {}

	// TODO: Fix how type is handled
	public graphType: DBGraphType = 'undirected';

	public async createNode(
		metadata: DBGraphNodeMetadata,
		internalId?: DBGraphNodeInternalId
	): Promise<DBGraphNodeResult> {
		await this.ensureConstraints();

		if (internalId) {
			metadata['_grs_internalId'] = internalId;
		}

		const nodeLabels = this.constructNodeLabelsFromAttributes(metadata);

		const $nodeVar = 'n';
		const { cypher, params } = createNodeQuery($nodeVar, nodeLabels, metadata);
		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run<Neo4jCreateNodeResult>(cypher, params)
		);

		const nodeRecords = res.records.map((record) => record.get($nodeVar));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes[0];
	}

	public async updateNode(
		metadata: DBGraphNodeMetadata,
		internalId: DBGraphNodeInternalId,
		oldTypes: string[] = [],
		options = {}
	): Promise<DBGraphNodeResult> {
		if (!internalId) {
			throw new Error(
				'Neo4jGraphService: no internalId given in updateNode clause'
			);
		}
		metadata['_grs_internalId'] = internalId;

		const nodeLabels = this.constructNodeLabelsFromAttributes(metadata);

		const removedLabels = oldTypes.filter((type) => !nodeLabels.includes(type));

		const nodeVar = 'n';
		const { cypher, params } = updateNodeQuery(
			nodeVar,
			internalId,
			nodeLabels,
			removedLabels,
			metadata,
			options
		);
		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run<Neo4jUpdateNodeResult>(cypher, params)
		);

		const nodeRecords = res.records.map((record) => record.get(nodeVar));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes[0];
	}

	public async getNode(internalId: DBGraphNodeInternalId) {
		const cypher = `MATCH (n) \
            WHERE n._grs_internalId = $internalId \
            RETURN n`;

		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run(cypher, { internalId })
		);

		const nodeRecords = res.records.map((record) => record.get('n'));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes[0];
	}

	public async getAllNodes() {
		// const cypher = `MATCH (n)
		// OPTIONAL MATCH (n)-[r]-(m)
		// RETURN COLLECT(DISTINCT n) AS nodes, COLLECT(DISTINCT r) AS relationships`;
		const cypher = `MATCH (n)
		    RETURN DISTINCT n`;

		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run<Neo4jGetNodesResult>(cypher)
		);

		const nodeRecords = res.records.map((record) => record.get('n'));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes;
	}

	public async deleteNode(internalId: DBGraphNodeInternalId) {
		const cypher = `MATCH (n) \
            WHERE n._grs_internalId = $internalId \
            DETACH DELETE n`;

		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run(cypher, { internalId })
		);
		const nodeRecords = res.records.map((record) => record.get('n'));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes[0];
	}

	public async deleteNodes(internalIds: DBGraphNodeInternalId[]) {
		const cypher = `MATCH (n) \
            WHERE n._grs_internalId in $internalIds \
            DETACH DELETE n`;

		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run(cypher, { internalIds })
		);
		const nodeRecords = res.records.map((record) => record.get('n'));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes;
	}

	public async deleteAllNodes() {
		const cypher =
			'MATCH (n) CALL (n) \
            { DETACH DELETE n } \
            IN TRANSACTIONS';

		const res = await this.session.run(cypher);

		const nodeRecords = res.records.map((record) => record.get('n'));
		const nodes = this.mapNodeRecordsToNodesResult(nodeRecords);

		return nodes || [];
	}

	// TODO: check which what kind of content can be saved in neo4j properties and type metadata accordingly
	public async createEdge(
		internalIdSource: DBGraphNodeInternalId,
		internalIdTarget: DBGraphNodeInternalId,
		internalId: DBGraphNodeInternalId,
		metadata: DBGraphEdgeMetadata
	) {
		await this.ensureConstraints();

		// Each relation in neo4j needs to have a relationship type
		const relation = this.defaultRelationshipLabel;

		const properties = {
			_grs_internalId: internalId,
			_grs_source: internalIdSource,
			_grs_target: internalIdTarget,
		};

		const attributes = {
			...metadata,
			...properties,
		};

		const cypher = `MATCH (a),(b) \
			WHERE a._grs_internalId = $internalIdSource \
			AND b._grs_internalId = $internalIdTarget \
			CREATE (a)-[r:${relation} $attributes ]->(b) RETURN r`;

		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run<Neo4jRelationshipResult>(cypher, {
				internalIdSource,
				internalIdTarget,
				attributes,
			})
		);

		const edgeRecords = res.records.map((record) => record.get('r'));
		const edges = this.mapEdgeRecordsToEdgesResult(edgeRecords);

		return edges[0];
	}

	public async updateEdge(
		internalIdSource: DBGraphNodeInternalId,
		internalIdTarget: DBGraphNodeInternalId,
		internalId: DBGraphNodeInternalId,
		metadata: DBGraphEdgeMetadata,
		options: EdgeUpdateRewriteOptions = {}
	) {
		if (!internalId) {
			throw new Error(
				'Neo4jGraphService: no internalId given in updateEdge clause'
			);
		}

		let attributes = {};

		const oldEdge = await this.getEdge(internalId);

		const replacementMode = options?.attributeReplacementMode;
		switch (replacementMode) {
			case 'delete':
				break;
			case 'replace':
				attributes = {
					...metadata,
				};
				break;
			case 'modify':
			default:
				if (oldEdge) {
					attributes = {
						...oldEdge.attributes,
						...metadata,
					};
				}
				break;
		}

		await this.deleteEdge(internalId);

		const edge = await this.createEdge(
			internalIdSource,
			internalIdTarget,
			internalId,
			attributes
		);

		return edge;
	}

	public async getEdge(internalId: DBGraphEdgeInternalId) {
		const cypher = `MATCH ()-[r]-() \
            WHERE r._grs_internalId = $internalId \
            RETURN r`;

		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run(cypher, { internalId })
		);

		const edgeRecords = res.records.map((record) => record.get('r'));
		const edges = this.mapEdgeRecordsToEdgesResult(edgeRecords);

		return edges[0];
	}

	public async deleteEdge(internalId: DBGraphEdgeInternalId) {
		const cypher = `MATCH ()-[r]-()
			WHERE r._grs_internalId = $internalId \
			DELETE r`;

		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run<Neo4jRelationshipResult>(cypher, {
				internalId,
			})
		);
		const edgeRecords = res.records.map((record) => record.get('r'));
		const edges = this.mapEdgeRecordsToEdgesResult(edgeRecords);

		return edges[0];
	}

	public async deleteEdges(internalIds: DBGraphEdgeInternalId[]) {
		const cypher = `MATCH ()-[r]-()
			WHERE r._grs_internalId in $internalIds \
			DELETE r`;

		const res = await this.session.executeWrite((tx: ManagedTransaction) =>
			tx.run<Neo4jRelationshipResult>(cypher, {
				internalIds,
			})
		);
		const edgeRecords = res.records.map((record) => record.get('r'));
		const edges = this.mapEdgeRecordsToEdgesResult(edgeRecords);

		return edges;
	}

	public async getAllEdges() {
		const cypher = `MATCH ()-[r]-() \
			RETURN DISTINCT r`;

		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run<Neo4jRelationshipResult>(cypher)
		);

		const edgeRecords = res.records.map((record) => record.get('r'));
		const edges = this.mapEdgeRecordsToEdgesResult(edgeRecords);

		return edges;
	}

	/**
	 * This function first generates a cypher query for matching the given pattern and then
	 * queries the database with it. It returns the found matches as an array of graph pattern matches.
	 *
	 * @param {DBGraphNode[]} nodes A set of the nodes to match
	 * @param {DBGraphEdge[]} edges A set of the edges to match
	 * @param {DBGraphType} [type="undirected"] Flag to determine wether edges should be matched "directed" or "undirected"
	 * @param {boolean} [homo=true] Flag to determine wether pattern should be matched homomorphic or isomorphic (injective). Defaults to homomorphic matching (allows self loops)
	 * @param {DBGraphNACs[]} [nacs=[]] A set of negative applications conditions
	 * @returns {Promise<DBGraphPatternMatchResult[] | []>}
	 */
	public async findPatternMatch(
		nodes: PatternNodeSchema[],
		edges: PatternEdgeSchema[],
		type: DBGraphType = 'undirected',
		homo = true,
		nacs: DBGraphNACs[] = []
	): Promise<DBGraphPatternMatchResult[] | []> {
		let query = '';
		let hasWhere = false;
		const queryVars: string[] = [];
		let parameters = {};

		const whereClauses: string[] = [];

		const nodesQueries: string[] = [];
		nodes.forEach((node) => {
			queryVars.push(node.key);

			// let nodeLabels: string[] = [];
			// if (node.attributes) {
			// 	nodeLabels = this.constructNodeLabelsFromAttributes(node.attributes);
			// }
			// Don't match type labels.
			const { cypher, where, params } = computeNodeQuery(
				node.key,
				[this.defaultNodeLabel],
				node.attributes ?? {}
			);

			if (where) whereClauses.push(where);
			if (params) parameters = { ...parameters, ...params };

			nodesQueries.push(cypher);
		});
		query += nodesQueries.join(', ');

		const edgesQueries: string[] = [];
		edges.forEach((edge) => {
			queryVars.push(edge.key);

			const { cypher, where, params } = computeEdgeQuery(
				edge.key,
				this.defaultRelationshipLabel,
				edge.attributes,
				edge.source,
				edge.target,
				type === 'directed'
			);

			if (where) whereClauses.push(where);
			if (params) parameters = { ...parameters, ...params };

			edgesQueries.push(cypher);
		});
		if (nodesQueries.length && edgesQueries.length) query += ', ';
		query += edgesQueries.join(', ');

		if (nacs && nacs.length) {
			const { cypher, where, params } = computeNacClause(nacs, hasWhere);
			query += cypher;
			hasWhere = where;
			if (params) parameters = { ...parameters, ...params };
		}

		if (!homo) {
			const nodeInjectivity = computeInjectivityClause(
				nodes.map((node) => node.key),
				hasWhere
			);
			query += nodeInjectivity.cypher;
			hasWhere = nodeInjectivity.hasWhere;

			const edgeInjectivity = computeInjectivityClause(
				edges.map((edge) => edge.key),
				hasWhere
			);
			query += edgeInjectivity.cypher;
			hasWhere = edgeInjectivity.hasWhere;
		}

		// If empty pattern set, return an empty result set
		if (!query.length && !queryVars.length) {
			return [{ nodes: {}, edges: {} }];
		}

		if (whereClauses.length) {
			if (!hasWhere) {
				query += ' WHERE';
			} else {
				query += ' AND';
			}

			query += whereClauses.join(' AND');
		}

		// Else build cypher and query database
		const cypher = `MATCH ${query} RETURN ${queryVars.join(', ')}`;

		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run<Neo4jPatternMatchResult>(cypher, parameters)
		);

		const result = this.mapPatternMatchToResult(res, queryVars);

		return result;
	}

	public mapPatternMatchToResult(
		queryResult: QueryResult<Neo4jPatternMatchResult>,
		queryVars: string[]
	): DBGraphPatternMatchResult[] {
		const records = queryResult.records;
		const result: DBGraphPatternMatchResult[] = [];
		records.forEach((patternOccurence) => {
			const occurencResult: DBGraphPatternMatchResult = {
				nodes: {},
				edges: {},
			};
			queryVars.forEach((queryVar) => {
				const graphItem = patternOccurence.get(queryVar);
				if (graphItem instanceof Node) {
					occurencResult.nodes[queryVar] =
						this.mapSingleNodeRecordToResult(graphItem);
				} else if (graphItem instanceof Relationship) {
					occurencResult.edges[queryVar] =
						this.mapSingleEdgeRecordToResult(graphItem);
				}
			});

			result.push(occurencResult);
		});
		return result;
	}

	private mapNodeRecordsToNodesResult(
		nodeRecords: Neo4jNode[]
	): DBGraphNodeResult[] {
		const nodes = nodeRecords.map((node) =>
			this.mapSingleNodeRecordToResult(node)
		);

		return nodes;
	}

	private mapSingleNodeRecordToResult(node: Neo4jNode) {
		const nodeData: DBGraphNodeResult = {
			key: node.properties?._grs_internalId,
			attributes: {
				...node.properties,
			},
		};
		// Remove all keys that were only for internal use
		delete nodeData.attributes?._grs_internalId;

		return nodeData;
	}

	private mapEdgeRecordsToEdgesResult(
		edgeRecords: Neo4jRelationship[]
	): DBGraphEdgeResult[] {
		const edges = edgeRecords.map((edge) =>
			this.mapSingleEdgeRecordToResult(edge)
		);

		return edges;
	}

	private mapSingleEdgeRecordToResult(edge: Neo4jRelationship) {
		const edgeData: DBGraphEdgeResult = {
			key: edge.properties._grs_internalId,
			source: edge.properties._grs_source,
			target: edge.properties._grs_target,
			attributes: {
				...edge.properties,
			},
		};
		// Remove all keys that were only for internal use
		delete edgeData.attributes?._grs_internalId;
		delete edgeData.attributes?._grs_source;
		delete edgeData.attributes?._grs_target;

		return edgeData;
	}

	private async ensureConstraints() {
		const constraints = {
			grs_node_id_unique: `CREATE CONSTRAINT grs_node_id_unique FOR (n:${this.defaultNodeLabel}) REQUIRE n._grs_internalId IS UNIQUE`,
			grs_edge_id_unique: `CREATE CONSTRAINT grs_edge_id_unique FOR ()-[r:${this.defaultRelationshipLabel}]-() REQUIRE r._grs_internalId IS UNIQUE`,
			// existence constraints are an enterprise only feature :(
			// grs_node_id_exists: `CREATE CONSTRAINT node_grs_id_exists FOR (n:${this.defaultNodeLabel}) REQUIRE n._grs_internalId IS NOT NULL`,
			// grs_edge_id_exists: `CREATE CONSTRAINT edge_grs_id_exists FOR ()-[r:${this.defaultRelationshipLabel}]-() REQUIRE r._grs_internalId IS NOT NULL`,
			// NODE KEYS & RELATIONSHIP KEYS constraints are an enterprise only feature :(
			// grs_node_key: `CREATE CONSTRAINT grs_node_key FOR (n:${this.defaultNodeLabel}) REQUIRE (n._grs_internalId) IS NODE KEY`,
			// grs_edge_key: `CREATE CONSTRAINT grs_edge_key FOR ()-[r:${this.defaultRelationshipLabel}]-() REQUIRE r._grs_internalId IS RELATIONSHIP KEY`,
		};

		// get all constraints
		const res = await this.session.executeRead((tx: ManagedTransaction) =>
			tx.run(`SHOW CONSTRAINTS`)
		);

		const constraintNames = res.records.map((record) => record.get('name'));

		// check if the necessary constraints exists
		// and create them if they don't exist
		for (const [constraintKey, constraintCypher] of Object.entries(
			constraints
		)) {
			if (!constraintNames.includes(constraintKey)) {
				await this.session.executeWrite((tx: ManagedTransaction) =>
					tx.run(constraintCypher)
				);
			}
		}
	}

	private constructNodeLabelsFromAttributes(
		attributes: DBGraphNodeMetadata | PatternNodeMetadata
	) {
		const nodeTypes = [this.defaultNodeLabel];
		if (attributes?.type) {
			if (!Array.isArray(attributes.type)) {
				nodeTypes.push(String(attributes.type));
			}
		}

		return nodeTypes;
	}
}
