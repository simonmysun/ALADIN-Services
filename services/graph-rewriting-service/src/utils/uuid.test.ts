import { expect, test, describe } from 'vitest';

import { createNodeUuid, createEdgeUuid, createParameterUuid } from './uuid';

describe('Test uuid helpers', () => {
	test("Test nodeUuid should start with 'n' an contain no '-' chars", () => {
		const nodeUuid = createNodeUuid();

		expect(nodeUuid).not.toContain('-');
		expect(nodeUuid.startsWith('n')).toBe(true);
	});

	test("Test edgeUuid should start with 'e' an contain no '-' chars", () => {
		const edgeUuid = createEdgeUuid();

		expect(edgeUuid).not.toContain('-');
		expect(edgeUuid.startsWith('e')).toBe(true);
	});

	test("Test parameterUuid should start with 'p' an contain no '-' chars", () => {
		const paramUuid = createParameterUuid();

		expect(paramUuid).not.toContain('-');
		expect(paramUuid.startsWith('p')).toBe(true);
	});
});
