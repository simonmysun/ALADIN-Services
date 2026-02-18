import { GraphEdgeSchema } from '../../types/edge.schema';
import { ReplacementGraphSchema } from '../../types/request-transform.schema';
import { PatternGraphSchema } from '../../types/patterngraph.schema';
import { PatternNodeSchema } from '../../types/patternnode.schema';
import { ReplacementEdgeSchema } from '../../types/replacementedge.schema';
import { ReplacementNodeSchema } from '../../types/replacementnode.schema';
import { createNodeUuid, createEdgeUuid } from '../../utils/uuid';
import { IGraphDB, DBGraphPatternMatchResult } from '../db/types';

interface GraphDiffResult {
	updatedNodes: NodeMatchMap;
	addedNodes: ReplacementNodeSchema[];
	removedNodes: PatternNodeSchema[];
	updatedEdges: EdgeMatchMap;
	addedEdges: ReplacementEdgeSchema[];
	removedEdges: GraphEdgeSchema[];
}

type NodeMatchMap = Map<string, ReplacementNodeSchema | undefined>;
type EdgeMatchMap = Map<string, ReplacementEdgeSchema | undefined>;

export class SpoRewriteService {
	constructor(private readonly graphService: IGraphDB) {}

	public async performReplacement(
		match: DBGraphPatternMatchResult,
		lhs: PatternGraphSchema,
		rhs: ReplacementGraphSchema
	) {
		const overlapAndDifference = this.computePreservationMorphism(lhs, rhs);

		await this.replaceMatch(match, overlapAndDifference);
	}

	/**
	 * Main Algorithm performing the actual replacing of the pattern match
	 * 1. Removes all nodes/edges that are in LHS, but NOT part of the RHS
	 * 2. Updates all nodes/edges that are in LHS and part of the RHS
	 * 3. Adds all nodes/edges that are part of the RHS but not the LHS
	 *
	 * @param occurence The match found in the database for the given lhs pattern
	 * @param adjustment The difference (added, updated, removed) between the LHS and RHS (gluing interface)
	 */
	private async replaceMatch(
		occurence: DBGraphPatternMatchResult,
		adjustments: GraphDiffResult
	) {
		// Map to keep track of updated/added nodes so that they can be referenced correctly in the edges
		let preservedNodes: Record<string, string> = {};

		// Remove all nodes and edges that are not in the replacement graph
		await this.deleteRemovedNodes(occurence, adjustments.removedNodes);
		await this.deleteRemovedEdges(occurence, adjustments.removedEdges);

		// Update all nodes and edges that are part of both search pattern and replacement graph
		if (Object.entries(occurence.nodes).length) {
			await this.updateUpdatedNodes(
				adjustments.updatedNodes,
				occurence.nodes,
				preservedNodes
			);
		}

		if (Object.entries(occurence.edges).length) {
			await this.updateUpdatedEdges(
				adjustments.updatedEdges,
				occurence.edges,
				preservedNodes
			);
		}

		// Add all new nodes & edges
		preservedNodes = await this.createAddedNodes(
			adjustments.addedNodes,
			preservedNodes
		);
		await this.createAddedEdges(adjustments.addedEdges, preservedNodes);

		return;
	}

	private async updateUpdatedNodes(
		updatedNodes: NodeMatchMap,
		oldNodes: DBGraphPatternMatchResult['nodes'],
		preservedNodes: Record<string, string>
	) {
		for (const [key, rhsNode] of updatedNodes) {
			if (rhsNode) {
				// const oldNode = occurence.nodes[key];
				const oldNode = oldNodes[key];
				const internalId = oldNode.key;

				let options = {};
				if (rhsNode?.rewriteOptions) {
					options = rhsNode.rewriteOptions;
				}

				await this.graphService.updateNode(
					rhsNode.attributes ?? {},
					internalId,
					oldNode.attributes?.type ? [oldNode.attributes?.type] : [],
					options
				);

				preservedNodes[key] = internalId;
			}
		}
	}

	private async updateUpdatedEdges(
		updatedEdges: EdgeMatchMap,
		oldEdges: DBGraphPatternMatchResult['edges'],
		preservedNodes: Record<string, string>
	) {
		for (const [key, rhsEdge] of updatedEdges) {
			if (rhsEdge) {
				const oldEdge = oldEdges[key];
				const internalId = oldEdge.key;

				const sourceInternalId = preservedNodes[rhsEdge.source];
				const targetInternalId = preservedNodes[rhsEdge.target];

				let options = {};
				if (rhsEdge?.rewriteOptions) {
					options = rhsEdge.rewriteOptions;
				}

				await this.graphService.updateEdge(
					sourceInternalId,
					targetInternalId,
					internalId,
					rhsEdge.attributes ?? [],
					options
				);

				preservedNodes[key] = internalId;
			}
		}
	}

	private async createAddedNodes(
		addedNodes: ReplacementNodeSchema[],
		preservedNodes: Record<string, string>
	) {
		for (const rhsNode of addedNodes) {
			const internalId = createNodeUuid();

			await this.graphService.createNode(rhsNode.attributes ?? {}, internalId);

			preservedNodes[rhsNode.key] = internalId;
		}

		return preservedNodes;
	}

	private async createAddedEdges(
		addedEdges: ReplacementEdgeSchema[],
		preservedNodes: Record<string, string>
	) {
		for (const rhsEdge of addedEdges) {
			const internalId = createEdgeUuid();

			const sourceInternalId = preservedNodes[rhsEdge.source];
			const targetInternalId = preservedNodes[rhsEdge.target];

			await this.graphService.createEdge(
				sourceInternalId,
				targetInternalId,
				internalId,
				rhsEdge.attributes
			);
		}
	}

	private async deleteRemovedNodes(
		occurence: DBGraphPatternMatchResult,
		removedNodes: PatternNodeSchema[]
	): Promise<void> {
		if (Object.entries(occurence.nodes).length) {
			const removedNodeIds = removedNodes.map((node) => {
				return occurence.nodes[node.key].key;
			});
			await this.graphService.deleteNodes(removedNodeIds);
		}
	}

	private async deleteRemovedEdges(
		occurence: DBGraphPatternMatchResult,
		removedEdges: GraphEdgeSchema[]
	): Promise<void> {
		if (Object.entries(occurence.edges).length) {
			const removedEdgesIds = removedEdges.map((edge) => {
				return occurence.edges[edge.key].key;
			});
			await this.graphService.deleteEdges(removedEdgesIds);
		}
	}

	private computePreservationMorphism(
		lhs: PatternGraphSchema,
		rhs: ReplacementGraphSchema
	): GraphDiffResult {
		const updatedNodes: NodeMatchMap = new Map();
		const removedNodes: PatternNodeSchema[] = [];
		const addedNodes: ReplacementNodeSchema[] = [];

		const updatedEdges: EdgeMatchMap = new Map();
		const removedEdges: GraphEdgeSchema[] = [];
		const addedEdges: ReplacementEdgeSchema[] = [];

		// All nodes in search graph that are also in replacement are "updated"
		// All nodes in search graph that are not in replacement are "deleted"
		for (const lhsNode of lhs.nodes) {
			const rhsNode = rhs.nodes.find((rhsNode) => rhsNode.key === lhsNode.key);

			if (rhsNode) {
				updatedNodes.set(lhsNode.key, rhsNode);
			} else {
				removedNodes.push(lhsNode);
			}
		}

		// All nodes that are in replacement but not in search graph are "added".
		// All search graph nodes should already be part of updated/removed, so if it
		// can't be found there, it has to be a new/added node
		for (const rhsNode of rhs.nodes) {
			if (!updatedNodes.has(rhsNode.key)) {
				addedNodes.push(rhsNode);
			}
		}

		// All edges in search graph that are also in replacement are "updated"
		// --> An edge is only identical, if both key, source and target match!
		// --> Nodes cannot be updated and will be deleted and recreated
		// TODO: Figure out what to do about attributes that are not explicitly specified
		// All edges in search graph that are not in replacement are "deleted"
		for (const lhsEdge of lhs.edges) {
			const rhsEdge = rhs.edges.find(
				(rhsEdge) =>
					rhsEdge.key === lhsEdge.key &&
					rhsEdge.source === lhsEdge.source &&
					lhsEdge.target === rhsEdge.target
			);

			if (rhsEdge) {
				updatedEdges.set(lhsEdge.key, rhsEdge);
			} else {
				removedEdges.push(lhsEdge);
			}
		}

		// All edges that are in replacement but not in search graph are "added".
		// All search graph edges should already be part of updated/removed, so if it
		// can't be found there, it has to be a new/added edge
		for (const rhsEdge of rhs.edges) {
			if (!updatedEdges.has(rhsEdge.key)) {
				addedEdges.push(rhsEdge);
			}
		}

		return {
			updatedNodes,
			updatedEdges,
			removedNodes,
			removedEdges,
			addedNodes,
			addedEdges,
		};
	}
}
