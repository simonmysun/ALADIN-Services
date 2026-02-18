import { expect, test, describe } from 'vitest';
import { createNodeQuery, updateNodeQuery } from './base';

describe('Test cypher query generation', () => {
	describe('Test createNodeQuery', () => {
		test('Test createNodeQuery with single label and no attributes', () => {
			const { cypher, params } = createNodeQuery('n', ['LabelA']);

			expect(cypher).toBe('CREATE (n:`LabelA`) RETURN n');
			expect(params).toStrictEqual({ nodeMetadata: {} });
		});

		test('Test createNodeQuery with single label with special chars and no attributes', () => {
			const { cypher, params } = createNodeQuery('n', ['Label`A']);

			expect(cypher).toBe('CREATE (n:`Label``A`) RETURN n');
			expect(params).toStrictEqual({ nodeMetadata: {} });
		});

		test('Test createNodeQuery with multiple labels and no attributes', () => {
			const { cypher, params } = createNodeQuery('n', ['LabelA', 'LabelB']);

			expect(cypher).toBe('CREATE (n:`LabelA`:`LabelB`) RETURN n');
			expect(params).toStrictEqual({ nodeMetadata: {} });
		});

		test('Test createNodeQuery with single label and attributes', () => {
			const { cypher, params } = createNodeQuery('n', ['LabelA', 'LabelB'], {
				attributeA: 'hello',
				attributeB: 2,
			});

			expect(cypher).toBe(
				'CREATE (n:`LabelA`:`LabelB` $nodeMetadata) RETURN n'
			);
			expect(params).toStrictEqual({
				nodeMetadata: {
					attributeA: 'hello',
					attributeB: 2,
				},
			});
		});
	});

	describe('Test updateNodeQuery', () => {
		test('Test updateNodeQuery with single label and no attributes', () => {
			const { cypher, params } = updateNodeQuery('n', 'n_1234', ['LabelA']);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n:`LabelA` SET n += $metadata  RETURN n'
			);
			expect(params).toStrictEqual({ internalId: 'n_1234', metadata: {} });
		});

		test('Test updateNodeQuery with single label and attributes', () => {
			const { cypher, params } = updateNodeQuery(
				'n',
				'n_1234',
				['LabelA'],
				[],
				{ hello: 'world' }
			);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n:`LabelA` SET n += $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { hello: 'world' },
			});
		});

		test('Test updateNodeQuery with single label, a removed label and attributes', () => {
			const { cypher, params } = updateNodeQuery(
				'n',
				'n_1234',
				['LabelA'],
				['LabelOld'],
				{ hello: 'world' }
			);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) REMOVE n:`LabelOld` SET n:`LabelA` SET n += $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { hello: 'world' },
			});
		});

		test('Test updateNodeQuery with no label and attributes', () => {
			const { cypher, params } = updateNodeQuery('n', 'n_1234', [], [], {
				hello: 'world',
			});

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n += $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { hello: 'world' },
			});
		});

		test('Test updateNodeQuery with no label and attributes, attributeReplacementMode "delete"', () => {
			const { cypher, params } = updateNodeQuery(
				'n',
				'n_1234',
				[],
				[],
				{
					hello: 'world',
				},
				{ attributeReplacementMode: 'delete' }
			);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n = $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { _grs_internalId: 'n_1234' },
			});
		});

		test('Test updateNodeQuery with no label and attributes, attributeReplacementMode "replace"', () => {
			const { cypher, params } = updateNodeQuery(
				'n',
				'n_1234',
				[],
				[],
				{
					hello: 'world',
				},
				{ attributeReplacementMode: 'replace' }
			);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n = $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { hello: 'world' },
			});
		});

		test('Test updateNodeQuery with no label and attributes, attributeReplacementMode "modify"', () => {
			const { cypher, params } = updateNodeQuery(
				'n',
				'n_1234',
				[],
				[],
				{
					hello: 'world',
				},
				{ attributeReplacementMode: 'modify' }
			);

			expect(cypher).toBe(
				'MATCH (n { _grs_internalId: $internalId }) SET n += $metadata  RETURN n'
			);
			expect(params).toStrictEqual({
				internalId: 'n_1234',
				metadata: { hello: 'world' },
			});
		});
	});
});
