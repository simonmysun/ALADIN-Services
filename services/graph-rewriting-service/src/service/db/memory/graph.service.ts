import {
	DBGraphEdgeInternalId,
	DBGraphNodeInternalId,
	DBGraphNodeMetadata,
	DBGraphNodeResult,
	IGraphDB,
	DBGraphEdgeResult,
	DBGraphEdgeMetadata,
	DBGraphType,
	DBGraphPatternMatchResult,
	DBGraphNACs,
	EdgeUpdateRewriteOptions,
	NodeUpdateRewriteOptions,
	DBGraphNode,
	DBGraphEdge,
} from '../types';
import { PatternNodeSchema } from '../../../types/patternnode.schema';

interface StoredNode {
	key: DBGraphNodeInternalId;
	attributes: DBGraphNodeMetadata;
}

interface StoredEdge {
	key: DBGraphEdgeInternalId;
	source: DBGraphNodeInternalId;
	target: DBGraphNodeInternalId;
	attributes: DBGraphEdgeMetadata;
}

export class InMemoryGraphService implements IGraphDB {
	private nodes: Map<string, StoredNode> = new Map();
	private edges: Map<string, StoredEdge> = new Map();

	public graphType: DBGraphType = 'undirected';

	public async createNode(
		metadata: DBGraphNodeMetadata,
		internalId?: DBGraphNodeInternalId
	): Promise<DBGraphNodeResult> {
		const key = internalId ?? '';
		const attributes = { ...metadata };
		delete attributes._grs_internalId;

		this.nodes.set(key, { key, attributes });

		return { key, attributes: { ...attributes } };
	}

	public async updateNode(
		metadata: DBGraphNodeMetadata,
		internalId: DBGraphNodeInternalId,
		oldTypes: string[] = [],
		options: NodeUpdateRewriteOptions = {}
	): Promise<DBGraphNodeResult> {
		if (!internalId) {
			throw new Error(
				'InMemoryGraphService: no internalId given in updateNode clause'
			);
		}

		const existing = this.nodes.get(internalId);
		if (!existing) {
			throw new Error(
				`InMemoryGraphService: node with id ${internalId} not found`
			);
		}

		let newAttributes: DBGraphNodeMetadata;
		const replacementMode = options?.attributeReplacementMode;

		switch (replacementMode) {
			case 'delete':
				newAttributes = {};
				break;
			case 'replace':
				newAttributes = { ...metadata };
				break;
			case 'modify':
			default:
				newAttributes = { ...existing.attributes, ...metadata };
				break;
		}

		delete newAttributes._grs_internalId;

		this.nodes.set(internalId, { key: internalId, attributes: newAttributes });

		return { key: internalId, attributes: { ...newAttributes } };
	}

	public async getNode(
		internalId: DBGraphNodeInternalId
	): Promise<DBGraphNodeResult | undefined> {
		const node = this.nodes.get(internalId);
		if (!node) return undefined;
		return { key: node.key, attributes: { ...node.attributes } };
	}

	public async deleteNode(
		internalId: DBGraphNodeInternalId
	): Promise<DBGraphNodeResult | undefined> {
		const node = this.nodes.get(internalId);

		// Detach delete: remove all connected edges
		for (const [edgeId, edge] of this.edges) {
			if (edge.source === internalId || edge.target === internalId) {
				this.edges.delete(edgeId);
			}
		}

		this.nodes.delete(internalId);

		if (!node) return undefined;
		return { key: node.key, attributes: { ...node.attributes } };
	}

	public async deleteNodes(
		internalIds: DBGraphNodeInternalId[]
	): Promise<DBGraphNodeResult[] | undefined> {
		const results: DBGraphNodeResult[] = [];
		for (const id of internalIds) {
			const result = await this.deleteNode(id);
			if (result) results.push(result);
		}
		return results.length ? results : undefined;
	}

	public async getAllNodes(): Promise<DBGraphNodeResult[]> {
		return Array.from(this.nodes.values()).map((node) => ({
			key: node.key,
			attributes: { ...node.attributes },
		}));
	}

	public async deleteAllNodes(): Promise<DBGraphNodeResult[]> {
		const all = await this.getAllNodes();
		this.nodes.clear();
		this.edges.clear();
		return all;
	}

	public async createEdge(
		internalIdSource: DBGraphNodeInternalId,
		internalIdTarget: DBGraphNodeInternalId,
		internalId: DBGraphEdgeInternalId,
		metadata: DBGraphEdgeMetadata
	): Promise<DBGraphEdgeResult> {
		const attributes = { ...metadata };

		const edge: StoredEdge = {
			key: internalId,
			source: internalIdSource,
			target: internalIdTarget,
			attributes,
		};

		this.edges.set(internalId, edge);

		return {
			key: internalId,
			source: internalIdSource,
			target: internalIdTarget,
			attributes: { ...attributes },
		};
	}

	public async updateEdge(
		internalIdSource: DBGraphNodeInternalId,
		internalIdTarget: DBGraphNodeInternalId,
		internalId: DBGraphEdgeInternalId,
		metadata: DBGraphEdgeMetadata,
		options: EdgeUpdateRewriteOptions = {}
	): Promise<DBGraphEdgeResult> {
		if (!internalId) {
			throw new Error(
				'InMemoryGraphService: no internalId given in updateEdge clause'
			);
		}

		const oldEdge = this.edges.get(internalId);

		let attributes: DBGraphEdgeMetadata = {};

		const replacementMode = options?.attributeReplacementMode;
		switch (replacementMode) {
			case 'delete':
				break;
			case 'replace':
				attributes = { ...metadata };
				break;
			case 'modify':
			default:
				if (oldEdge) {
					attributes = { ...oldEdge.attributes, ...metadata };
				} else {
					attributes = { ...metadata };
				}
				break;
		}

		this.edges.delete(internalId);

		return this.createEdge(
			internalIdSource,
			internalIdTarget,
			internalId,
			attributes
		);
	}

	public async getEdge(
		internalId: DBGraphEdgeInternalId
	): Promise<DBGraphEdgeResult | undefined> {
		const edge = this.edges.get(internalId);
		if (!edge) return undefined;
		return {
			key: edge.key,
			source: edge.source,
			target: edge.target,
			attributes: { ...edge.attributes },
		};
	}

	public async deleteEdge(
		internalId: DBGraphEdgeInternalId
	): Promise<DBGraphEdgeResult> {
		const edge = this.edges.get(internalId);
		this.edges.delete(internalId);

		if (!edge) {
			return { key: internalId, source: '', target: '', attributes: {} };
		}

		return {
			key: edge.key,
			source: edge.source,
			target: edge.target,
			attributes: { ...edge.attributes },
		};
	}

	public async deleteEdges(
		internalIds: DBGraphEdgeInternalId[]
	): Promise<DBGraphEdgeResult[]> {
		const results: DBGraphEdgeResult[] = [];
		for (const id of internalIds) {
			results.push(await this.deleteEdge(id));
		}
		return results;
	}

	public async getAllEdges(): Promise<DBGraphEdgeResult[]> {
		return Array.from(this.edges.values()).map((edge) => ({
			key: edge.key,
			source: edge.source,
			target: edge.target,
			attributes: { ...edge.attributes },
		}));
	}

	/**
	 * In-memory pattern matching implementation.
	 *
	 * Uses backtracking to find all subgraph matches of the given pattern
	 * (nodes + edges) in the current graph, respecting attribute constraints,
	 * directed/undirected edges, homomorphic/isomorphic matching, and NACs.
	 */
	public async findPatternMatch(
		nodes: PatternNodeSchema[],
		edges: DBGraphEdge[],
		type: DBGraphType = 'undirected',
		homo = true,
		nacs: DBGraphNACs[] = []
	): Promise<DBGraphPatternMatchResult[] | []> {
		// Empty pattern → single empty match
		if (!nodes.length && !edges.length) {
			return [{ nodes: {}, edges: {} }];
		}

		const allNodes = Array.from(this.nodes.values());
		const allEdges = Array.from(this.edges.values());

		// Step 1: Find all node assignments via backtracking
		const nodeBindings = this.findNodeBindings(nodes, allNodes, homo, 0, {});

		// Step 2: For each node binding, find matching edge assignments
		const results: DBGraphPatternMatchResult[] = [];

		for (const nodeBinding of nodeBindings) {
			const edgeBindings = this.findEdgeBindings(
				edges,
				allEdges,
				nodeBinding,
				type,
				homo,
				0,
				{}
			);

			for (const edgeBinding of edgeBindings) {
				// Step 3: Check NACs
				if (
					this.checkNACs(nacs, nodeBinding, edgeBinding, allNodes, allEdges)
				) {
					const matchResult: DBGraphPatternMatchResult = {
						nodes: {},
						edges: {},
					};

					for (const [patternKey, storedNode] of Object.entries(nodeBinding)) {
						matchResult.nodes[patternKey] = {
							key: storedNode.key,
							attributes: { ...storedNode.attributes },
						};
					}

					for (const [patternKey, storedEdge] of Object.entries(edgeBinding)) {
						matchResult.edges[patternKey] = {
							key: storedEdge.key,
							source: storedEdge.source,
							target: storedEdge.target,
							attributes: { ...storedEdge.attributes },
						};
					}

					results.push(matchResult);
				}
			}
		}

		return results;
	}

	// --- Pattern matching internals ---

	private findNodeBindings(
		patternNodes: PatternNodeSchema[],
		allNodes: StoredNode[],
		homo: boolean,
		index: number,
		current: Record<string, StoredNode>
	): Record<string, StoredNode>[] {
		if (index >= patternNodes.length) {
			return [{ ...current }];
		}

		const patternNode = patternNodes[index];
		const results: Record<string, StoredNode>[] = [];

		for (const candidate of allNodes) {
			// Check attribute match
			if (!this.nodeMatchesPattern(candidate, patternNode)) continue;

			// Isomorphic check: no two pattern nodes map to same host node
			if (
				!homo &&
				Object.values(current).some((bound) => bound.key === candidate.key)
			) {
				continue;
			}

			current[patternNode.key] = candidate;
			const subResults = this.findNodeBindings(
				patternNodes,
				allNodes,
				homo,
				index + 1,
				current
			);
			results.push(...subResults);
			delete current[patternNode.key];
		}

		return results;
	}

	private findEdgeBindings(
		patternEdges: DBGraphEdge[],
		allEdges: StoredEdge[],
		nodeBinding: Record<string, StoredNode>,
		type: DBGraphType,
		homo: boolean,
		index: number,
		current: Record<string, StoredEdge>
	): Record<string, StoredEdge>[] {
		if (index >= patternEdges.length) {
			return [{ ...current }];
		}

		const patternEdge = patternEdges[index];
		const results: Record<string, StoredEdge>[] = [];

		const sourceNode = nodeBinding[patternEdge.source];
		const targetNode = nodeBinding[patternEdge.target];

		if (!sourceNode || !targetNode) return [];

		for (const candidate of allEdges) {
			// Isomorphic check for edges
			if (
				!homo &&
				Object.values(current).some((bound) => bound.key === candidate.key)
			) {
				continue;
			}

			let matches = false;
			if (type === 'directed') {
				matches =
					candidate.source === sourceNode.key &&
					candidate.target === targetNode.key;
			} else {
				matches =
					(candidate.source === sourceNode.key &&
						candidate.target === targetNode.key) ||
					(candidate.source === targetNode.key &&
						candidate.target === sourceNode.key);
			}

			if (!matches) continue;

			// Check attribute match
			if (!this.edgeMatchesPattern(candidate, patternEdge)) continue;

			current[patternEdge.key] = candidate;
			const subResults = this.findEdgeBindings(
				patternEdges,
				allEdges,
				nodeBinding,
				type,
				homo,
				index + 1,
				current
			);
			results.push(...subResults);
			delete current[patternEdge.key];
		}

		return results;
	}

	private nodeMatchesPattern(
		node: StoredNode,
		pattern: PatternNodeSchema
	): boolean {
		if (!pattern.attributes) return true;

		for (const [attr, value] of Object.entries(pattern.attributes)) {
			const nodeValue = node.attributes[attr];

			if (Array.isArray(value)) {
				// Pattern value is array → node value must be in the array
				if (!value.includes(nodeValue as never)) return false;
			} else {
				if (nodeValue !== value) return false;
			}
		}

		return true;
	}

	private edgeMatchesPattern(edge: StoredEdge, pattern: DBGraphEdge): boolean {
		if (!pattern.attributes) return true;

		for (const [attr, value] of Object.entries(pattern.attributes)) {
			const edgeValue = edge.attributes[attr];

			if (Array.isArray(value)) {
				if (!value.includes(edgeValue as never)) return false;
			} else {
				if (edgeValue !== value) return false;
			}
		}

		return true;
	}

	/**
	 * NAC check: for each NAC, try to extend the current match with the NAC's
	 * pattern. If any extension is found, the NAC is violated and the match
	 * should be rejected.
	 *
	 * Returns true if all NACs pass (no violations found).
	 */
	private checkNACs(
		nacs: DBGraphNACs[],
		nodeBinding: Record<string, StoredNode>,
		edgeBinding: Record<string, StoredEdge>,
		allNodes: StoredNode[],
		allEdges: StoredEdge[]
	): boolean {
		for (const nac of nacs) {
			const nacNodes = (nac.nodes || []) as PatternNodeSchema[];
			const nacEdges = (nac.edges || []) as DBGraphEdge[];
			const nacType = nac.options?.type ?? 'undirected';

			// First, check if already-bound NAC nodes satisfy the NAC's attribute constraints
			let boundNodesMatch = true;
			for (const nacNode of nacNodes) {
				if (nacNode.key in nodeBinding) {
					// This NAC node is already bound — check attribute constraints
					if (
						nacNode.attributes &&
						!this.nodeMatchesPattern(nodeBinding[nacNode.key], nacNode)
					) {
						boundNodesMatch = false;
						break;
					}
				}
			}

			if (!boundNodesMatch) {
				// Already-bound nodes don't satisfy NAC constraints → NAC can't match → passes
				continue;
			}

			// Find new (unbound) NAC nodes that need to be matched
			const newNacNodes = nacNodes.filter((n) => !(n.key in nodeBinding));

			// Build a combined node binding that includes existing bindings
			// Then try to extend with new NAC nodes
			const nacNodeBindings = this.findNodeBindings(
				newNacNodes,
				allNodes,
				true, // NAC matching is homomorphic
				0,
				{ ...nodeBinding }
			);

			for (const nacNodeBinding of nacNodeBindings) {
				const nacEdgeBindings = this.findEdgeBindings(
					nacEdges,
					allEdges,
					nacNodeBinding,
					nacType as DBGraphType,
					true,
					0,
					{}
				);

				if (nacEdges.length === 0 || nacEdgeBindings.length > 0) {
					// NAC pattern found → this match is invalid
					return false;
				}
			}
		}

		return true;
	}
}
