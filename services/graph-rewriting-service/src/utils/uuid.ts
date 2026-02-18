import { v4 as uuid } from 'uuid';

function createNormalizedUuid() {
	return `${uuid().replaceAll('-', '')}`;
}

export function createNodeUuid() {
	return 'n_' + createNormalizedUuid();
}

export function createEdgeUuid() {
	return 'e_' + createNormalizedUuid();
}

export function createParameterUuid() {
	return 'p_' + createNormalizedUuid();
}
