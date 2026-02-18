import AbstractGraph, { SerializedGraph } from 'graphology-types';
import { createEdgeUuid, createNodeUuid } from '../../utils/uuid';
import Graph from 'graphology';
import {
	GrsGraphEdgeMetadata,
	GrsGraphMetadata,
	GrsGraphNodeMetadata,
} from './types';

export class GraphologyParserService {
	public parseGraph(
		graphData: SerializedGraph
	): Graph<GrsGraphNodeMetadata, GrsGraphEdgeMetadata, GrsGraphMetadata> {
		const graph = Graph.from(graphData);

		const enhancedGraph = this.addInternalIdAttributes(graph);

		return enhancedGraph;
	}

	private addInternalIdAttributes(
		graph: AbstractGraph
	): Graph<GrsGraphNodeMetadata, GrsGraphEdgeMetadata, GrsGraphMetadata> {
		graph.forEachNode((nodeKey) => {
			graph.setNodeAttribute(nodeKey, '_grs_internalId', createNodeUuid());
		});

		graph.forEachEdge((edgeKey) => {
			graph.setEdgeAttribute(edgeKey, '_grs_internalId', createEdgeUuid());
		});

		return graph as Graph<
			GrsGraphNodeMetadata,
			GrsGraphEdgeMetadata,
			GrsGraphMetadata
		>;
	}
}
