import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';

import { GraphTransformationService } from './graph-transformation.service';
import { IGraphDB } from '../db/types';
import { GraphSchema } from '../../types/graph.schema';

// Example Data
import sampleGraphData from './__tests__/utils/samplegraph.json';

describe('Test GRS service', () => {
	let mockGraphService: IGraphDB;

	beforeEach(() => {
		mockGraphService = {
			createNode: vi.fn(),
			getAllNodes: vi.fn(),
			deleteAllNodes: vi.fn(),
			createEdge: vi.fn(),
			getAllEdges: vi.fn(),
		} as unknown as IGraphDB;
	});

	afterEach(() => {
		vi.resetAllMocks(); // Clear and set back implementation
	});

	test('Test loadGraphIntoDb should call GraphService functions', async () => {
		const grsService = new GraphTransformationService(mockGraphService);

		const createNodeSpy = vi.spyOn(mockGraphService, 'createNode');
		const createEdgeSpy = vi.spyOn(mockGraphService, 'createEdge');
		const deleteAllNodesSpy = vi.spyOn(mockGraphService, 'deleteAllNodes');

		mockGraphService.getAllNodes = vi
			.fn()
			.mockResolvedValue(sampleGraphData.nodes);
		mockGraphService.getAllEdges = vi
			.fn()
			.mockResolvedValue(sampleGraphData.edges);

		const result = await grsService.importHostgraph(
			sampleGraphData as GraphSchema
		);

		// Old nodes should have been deleted
		expect(deleteAllNodesSpy).toHaveBeenCalled();

		// Graph service functions should have been called fo all nodes (2) and edges (1)
		expect(createNodeSpy).toHaveBeenCalled();
		expect(createNodeSpy).toHaveBeenCalledTimes(2);
		expect(createEdgeSpy).toHaveBeenCalled();
		expect(createEdgeSpy).toHaveBeenCalledTimes(1);

		// Result should be the same as the input
		// (except for the changed ids, which we did not respect in the mock above)
		expect(result).toMatchObject({
			options: sampleGraphData.options,
			nodes: result.nodes,
			edges: result.edges,
		});
	});
});
