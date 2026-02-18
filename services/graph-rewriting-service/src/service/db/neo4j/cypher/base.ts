import {
	DBGraphNodeInternalId,
	DBGraphNodeMetadata,
	NodeUpdateRewriteOptions,
} from '../../types';

import { QueryComputationResult, sanitizeIdentifier } from './utils';

export function createNodeQuery(
	matchVariable: string,
	labels: string[],
	attributes: Record<string, unknown> = {}
): QueryComputationResult {
	const nodeLabels = labels
		.map((label) => `\`${sanitizeIdentifier(label)}\``)
		.join(':');

	const params: Record<string, Record<string, unknown>> = {};
	if (attributes) {
		params.nodeMetadata = attributes;
	}
	const cypher = `CREATE (${matchVariable}:${nodeLabels}${Object.entries(params?.nodeMetadata).length ? ' $nodeMetadata' : ''}) RETURN ${matchVariable}`;

	return { cypher, params };
}

export function updateNodeQuery(
	matchVariable: string,
	internalId: DBGraphNodeInternalId,
	labels: string[] = [],
	removedLabels: string[] = [],
	attributes: DBGraphNodeMetadata = {},
	options: NodeUpdateRewriteOptions = {}
): QueryComputationResult {
	let cypher = '';
	const params: { internalId: string; metadata?: Record<string, unknown> } = {
		internalId,
	};

	cypher += `MATCH (${matchVariable} { _grs_internalId: $internalId }) `;

	if (removedLabels && removedLabels.length) {
		const sanitizedRemovedLabels = removedLabels
			.map((label) => `\`${sanitizeIdentifier(label)}\``)
			.join(':');

		cypher += `REMOVE ${matchVariable}:${sanitizedRemovedLabels} `;
	}

	if (labels && labels.length) {
		const sanitizedLabels = labels
			.map((label) => `\`${sanitizeIdentifier(label)}\``)
			.join(':');

		cypher += `SET ${matchVariable}:${sanitizedLabels} `;
	}

	if (options.attributeReplacementMode === 'delete') {
		const metadata = { _grs_internalId: internalId };
		params['metadata'] = metadata;
		cypher += `SET ${matchVariable} = $metadata `;
	} else if (options.attributeReplacementMode === 'replace') {
		cypher += `SET ${matchVariable} = $metadata `;
		params['metadata'] = attributes;
	} else {
		// default should be to "update" the metadata
		cypher += `SET ${matchVariable} += $metadata `;
		params['metadata'] = attributes;
	}

	cypher += ` RETURN ${matchVariable}`;

	return { cypher, params };
}
