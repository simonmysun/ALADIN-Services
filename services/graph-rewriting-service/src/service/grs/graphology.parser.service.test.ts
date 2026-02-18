import { describe, expect, test } from 'vitest';
import { GraphologyParserService } from './graphology.parser.service';

import sampleGraphData from './__tests__/utils/samplegraph.json';
import { SerializedGraph } from 'graphology-types';

describe('Test graphology parser service', () => {
	test('Test graphologyParser should add internalId', async () => {
		const graphParserService = new GraphologyParserService();

		const parsedGraph = graphParserService.parseGraph(
			sampleGraphData as unknown as SerializedGraph
		);

		parsedGraph.forEachNode((node, attributes) => {
			expect(attributes).toHaveProperty('_grs_internalId');

			// Our sample graph nodes contains one attribute: "label"
			expect(attributes).toEqual({
				_grs_internalId: expect.stringMatching(/^(n_)/),
				label: expect.any(String),
			});
		});

		parsedGraph.forEachEdge((edge, attributes) => {
			expect(attributes).toHaveProperty('_grs_internalId');

			// Our sample graph contains one attribute: "label"
			expect(attributes).toEqual(
				expect.objectContaining({
					_grs_internalId: expect.stringMatching(/^(e_)/),
				})
			);
		});
	});
});
