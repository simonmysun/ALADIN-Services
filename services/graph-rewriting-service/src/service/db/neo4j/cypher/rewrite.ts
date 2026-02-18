import { createParameterUuid } from '../../../../utils/uuid';
import { DBGraphEdge, DBGraphNACs } from '../../types';
import { DEFAULT_NODE_LABEL, DEFAULT_RELATIONSHIP_LABEL } from '../constants';
import {
	computeAttributesString,
	MatchQueryComputationResult,
	sanitizeIdentifier,
} from './utils';

function computeAttributeWhereClause(
	attributes: Record<string, unknown>,
	matchVariable: string
) {
	let clause = '';
	const params: Record<string, unknown> = {};

	for (const [attribute, value] of Object.entries(attributes)) {
		if (clause) {
			clause += ' AND';
		}

		const paramId = createParameterUuid();

		params[paramId] = value;

		if (Array.isArray(value)) {
			clause += ` ${matchVariable}.${attribute} IN $${paramId}`;
		} else {
			clause += ` ${matchVariable}.${attribute} = $${paramId}`;
		}
	}

	return { where: `${clause}`, params };
}

export function computeNodeQuery(
	matchVariable: string,
	labels: string[],
	attributes: Record<string, unknown>
): MatchQueryComputationResult {
	const result: MatchQueryComputationResult = {
		cypher: '',
	};
	matchVariable = sanitizeIdentifier(matchVariable);

	const nodeLabels = labels
		.map((label) => `\`${sanitizeIdentifier(label)}\``)
		.join(':');

	if (Object.keys(attributes).length) {
		const { where, params } = computeAttributeWhereClause(
			attributes,
			matchVariable
		);
		result['where'] = where;
		result['params'] = params;
	}

	// result.cypher = `(\`${matchVariable}\`)`;
	result.cypher = `(\`${matchVariable}\`:${nodeLabels})`;

	return result;
}

export function computeNodeQueryString(
	matchVariable: string,
	labels: string[],
	attributes: Record<string, unknown>
) {
	matchVariable = sanitizeIdentifier(matchVariable);

	// TODO: Use parameters instead of string concatenation for attributes
	const nodeLabels = labels
		.map((label) => `\`${sanitizeIdentifier(label)}\``)
		.join(':');

	const metadata = computeAttributesString(attributes);

	return `(\`${matchVariable}\`:${nodeLabels}${metadata.length ? ` ${metadata}` : ''})`;
}

export function computeEdgeQuery(
	matchVariable: string,
	type: string,
	attributes: Record<string, unknown>,
	source: string,
	target: string,
	directed = false
): MatchQueryComputationResult {
	const result: MatchQueryComputationResult = {
		cypher: '',
	};

	matchVariable = sanitizeIdentifier(matchVariable);

	if (Object.keys(attributes).length) {
		const { where, params } = computeAttributeWhereClause(
			attributes,
			matchVariable
		);
		result['where'] = where;
		result['params'] = params;
	}

	result.cypher = `(${source})-${type ? `[\`${matchVariable}\`:${type}]` : `[\`${matchVariable}\`]`}-${directed ? '>' : ''}(${target})`;

	return result;
}

export function computeEdgeQueryString(
	matchVariable: string,
	type: string,
	attributes: Record<string, unknown>,
	source: string,
	target: string,
	directed = false
) {
	matchVariable = sanitizeIdentifier(matchVariable);

	const metadata = computeAttributesString(attributes);

	return `(${source})-${type ? `[\`${matchVariable}\`:${type}${metadata.length ? ` ${metadata}` : ''}]` : `[\`${matchVariable}\`]`}-${directed ? '>' : ''}(${target})`;
}

/**
 * This function computes a cypher string that ensures the inequality
 * of each matchVariables in the matchVariables set
 *
 * @param {string[]} matchVariables The keys that the graph elements are matched to
 */
function computeInjectivityString(matchVariables: string[]) {
	let cypher = '';

	for (let i = 0; i < matchVariables.length; i++) {
		const a = sanitizeIdentifier(matchVariables[i]);
		for (let j = i + 1; j < matchVariables.length; j++) {
			const b = sanitizeIdentifier(matchVariables[j]);
			if (i > 0 || j > 1) {
				cypher += ' AND';
			}
			cypher += ` \`${a}\` <> \`${b}\``;
		}
	}

	return cypher;
}

/**
 * This function computes the cypher to ensure injective (isomorphic) matching -
 * i.e. two pattern elements can not be bound to the same host graph element
 *
 * @param {string[]} matchVariables The keys that the graph elements are matched to
 * @param hasWhere
 */
export function computeInjectivityClause(
	matchVariables: string[],
	hasWhere: boolean
) {
	let cypher = '';
	const injectivity = computeInjectivityString(matchVariables);
	if (injectivity) {
		if (!hasWhere) {
			cypher += ' WHERE';
			hasWhere = true;
		} else {
			cypher += ' AND';
		}
		cypher += injectivity;
	}
	return { cypher, hasWhere };
}

/**
 * This function generates a negative search pattern by checking wether the given
 * negative application conditions may extend the found search results.
 * If so, the matches are dropped.
 *
 * To implement this, it genererates a cypher query of the form:
 *
 * MATCH (n)
 * WITH * call {
 *     WITH * MATCH (x)
 *     WITH * MATCH (x)-[:related_to]->(n)
 *     return COUNT(*) as _nac
 * }
 * WITH * WHERE _nac=0
 * RETURN n
 *
 */
export function computeNacClause(nacs: DBGraphNACs[], hasWhere: boolean) {
	let cypher = '';
	let parameters = {};
	nacs.forEach((nac, index) => {
		const nacNodes = nac.nodes;
		const nacEdges = nac.edges;

		const whereClauses: string[] = [];

		// TODO: Check if the "WITH" is needed here
		cypher += ' WITH * call {';

		const nodesQueries: string[] = [];
		nacNodes?.forEach((node) => {
			const { cypher, where, params } = computeNodeQuery(
				node.key,
				[DEFAULT_NODE_LABEL],
				node.attributes ?? {}
			);

			if (where) whereClauses.push(where);
			if (params) parameters = { ...parameters, ...params };

			nodesQueries.push(cypher);
		});
		if (nodesQueries.length) {
			cypher += ` WITH * MATCH ` + nodesQueries.join(', ');
		}

		const directed =
			nac?.options?.type && nac.options.type === 'directed' ? true : false;

		if (nacEdges) {
			const edgeQueries: string[] = [];
			nacEdges?.forEach((edge) => {
				const { cypher, where, params } = computeEdgeQuery(
					edge.key,
					DEFAULT_RELATIONSHIP_LABEL,
					edge.attributes ?? {},
					edge.source,
					edge.target,
					directed
				);

				if (where) whereClauses.push(where);
				if (params) parameters = { ...parameters, ...params };

				edgeQueries.push(cypher);
			});
			if (edgeQueries.length) {
				cypher += ` WITH * MATCH ` + edgeQueries.join(', ');
			}

			whereClauses.push(computeExlusionOfSymmetricMatches(nacEdges));
		}

		if (whereClauses.length) {
			const filteredWhereClauses = whereClauses.filter(
				(item) => item.trim().length
			);
			cypher += ` WHERE ${filteredWhereClauses.join(' AND ')} `;
		}

		cypher += ` RETURN COUNT(*) as nac_matches${index} }`;

		cypher += ` WITH * WHERE nac_matches${index}=0`;
		hasWhere = true;
	});

	return { cypher, where: hasWhere, params: parameters };
}

function computeExlusionOfSymmetricMatches(edges: DBGraphEdge[]) {
	const seen: string[] = [];
	const targetByStartNode = new Map();
	let cypher = '';
	edges.forEach((edge) => {
		if (!seen.includes(edge.target)) {
			if (!targetByStartNode.has(edge.source)) {
				targetByStartNode.set(edge.source, []);
			}
			const targets = targetByStartNode.get(edge.source);
			targets.push(edge.target);
			seen.push(edge.target);
		}
	});

	const used: string[] = [];
	targetByStartNode.forEach((map) => {
		if (map.length > 1) {
			const edgeKey = map[0];
			if (!used.includes(edgeKey)) {
				used.push(edgeKey);
				for (let i = 1; i < map.length; i++) {
					if (map[i] && !used.includes(map[i])) {
						const edgeKey2 = map[i];
						if (cypher) {
							cypher += 'AND ';
						}
						cypher += `${edgeKey} <> ${edgeKey2} AND id(${edgeKey}) < id(${edgeKey2}) `;
					}
				}
			}
		}
	});

	return cypher;
}
