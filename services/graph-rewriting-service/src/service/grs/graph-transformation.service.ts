import Graph from 'graphology';
import {
	ExternalReplacementGraphConfig,
	GraphRewritingRequestSchema,
	GraphSchema,
} from '../../types/request-transform.schema';
import { GraphRewritingRuleSchema } from '../../types/rewrite-rule.schema';
import {
	DBGraphEdgeMetadata,
	DBGraphNodeMetadata,
	DBGraphPatternMatchResult,
	IGraphDB,
} from '../db/types';
import { GraphologyParserService } from './graphology.parser.service';
import {
	GrsGraphEdgeMetadata,
	GrsGraphMetadata,
	GrsGraphNodeMetadata,
} from './types';
import { GraphNodeSchema } from '../../types/node.schema';
import { GraphEdgeSchema } from '../../types/edge.schema';
import { RewritingRuleProcessingConfigSchema } from '../../types/run-config.schema';
import { InstantiatorService } from '../instantiation/instantiator.service';
import { NacSchema, PatternGraphSchema } from '../../types/patterngraph.schema';
import { ReplacementGraphSchema } from '../../types/replacementgraph.schema';
import { ReplacementNodeSchema } from '../../types/replacementnode.schema';
import { ReplacementEdgeSchema } from '../../types/replacementedge.schema';
import { getRandomIntBetween } from '../../utils/numbers';
import { SpoRewriteService } from './spo-rewrite.service';
import { logger } from '../../utils/logger';
import { HistoryService } from './history.service';
import { GraphFindRuleSchema } from '../../types/find-rule.schema';

export type ResultGraphSchema = Omit<GraphSchema, 'nodes' | 'edges'> & {
	nodes: (Omit<GraphNodeSchema, 'attributes'> & {
		attributes: DBGraphNodeMetadata;
	})[];
	edges: (Omit<GraphEdgeSchema, 'attributes'> & {
		attributes: DBGraphEdgeMetadata;
	})[];
};

export type RewriteRuleOptions = GraphRewritingRuleSchema['options'];
export type FindRuleOptions = GraphFindRuleSchema['options'];

export class GraphTransformationService {
	private instantiatorService;
	private historyService;
	private trackHistory = false;
	private hostgraphOptions: GraphSchema['options'] = {
		type: 'undirected',
	};

	constructor(private readonly graphService: IGraphDB) {
		this.instantiatorService = new InstantiatorService();
		this.historyService = new HistoryService();
	}

	public async transformGraph(
		hostgraphData: GraphSchema,
		rules: GraphRewritingRuleSchema[] = [],
		processingConfig: RewritingRuleProcessingConfigSchema[] = [],
		options: GraphRewritingRequestSchema['options'] = {}
	): Promise<ResultGraphSchema[]> {
		logger.info('GraphTransformationService: Starting graph transformation.');

		await this.initializeHostGraph(hostgraphData);

		this.historyService.clearHistory();
		this.trackHistory = options?.returnHistory || false;

		if (processingConfig.length) {
			for (const processStep of processingConfig) {
				const ruleConfig = rules.find((rule) => rule.key === processStep.rule);

				if (!ruleConfig) {
					throw Error(`Rule "${processStep.rule}" not found`);
				}

				await this.executeRule(ruleConfig, processStep);
			}
		} else {
			// If no sequence config is given, run and replace only the first match
			logger.info(
				'GraphTransformationService: No sequence configuration provided. Executing rules sequentially, replacing only the first match.'
			);
			for (const rule of rules) {
				await this.executeRule(rule);
			}
		}

		const finalHostgraph = await this.exportHostgraph();
		this.historyService.addToHistory(finalHostgraph);
		logger.info(
			'GraphTransformationService: Graph transformation completed. Final host graph exported.'
		);

		return this.historyService.getHistory();
	}

	public async matchPattern(
		hostgraphData: GraphSchema,
		rules: GraphFindRuleSchema[] = []
	) {
		if (rules.length) {
			await this.initializeHostGraph(hostgraphData);

			const { options, patternGraph } = rules[0];
			const matches = await this.findPatternMatches(patternGraph, options);
			return matches;
		}

		return [];
	}

	private async executeRule(
		ruleConfig: GraphRewritingRuleSchema,
		sequenceConfig?: RewritingRuleProcessingConfigSchema
	) {
		const { options, patternGraph } = ruleConfig;
		const replacementGraph = ruleConfig.replacementGraph;

		logger.debug(
			`GraphTransformationService: Executing rule "${ruleConfig.key}"`
		);
		const repetitions = this.getRepetitionOption(sequenceConfig);
		if (repetitions > 1) {
			logger.debug(
				`GraphTransformationService: Rule is set to be repeated ${repetitions} times`
			);
		}

		for (let i = 0; i < repetitions; i++) {
			// Handle edge case for empty pattern
			// Additions are still possible!
			if (!patternGraph.nodes.length && !patternGraph.edges.length) {
				const match = { nodes: {}, edges: {} };
				await this.handleMatch(match, patternGraph, replacementGraph);
				logger.debug(
					`GraphTransformationService: Finished executing rule "${ruleConfig.key}"`
				);
				return;
			}

			const matches = await this.findPatternMatches(patternGraph, options);

			logger.debug(
				`GraphTransformationService: Found ${matches.length} match(es)`
			);

			if (matches.length) {
				const max = this.calcMaxReplacements(matches.length, sequenceConfig);
				logger.debug(`GraphTransformationService: Replacing ${max} match(es)`);

				for (let i = 0; i < max; i++) {
					const match = matches[i];

					await this.handleMatch(match, patternGraph, replacementGraph);
				}
			}
		}
		logger.debug(
			`GraphTransformationService: Finished executing rule "${ruleConfig.key}"`
		);
	}

	private async findPatternMatches(
		patternGraph: PatternGraphSchema,
		options: RewriteRuleOptions | FindRuleOptions
	) {
		const homomorphic = this.getHomomorphicOption(options);
		const nacs: NacSchema[] = this.getNACs(patternGraph);

		const matches = await this.graphService.findPatternMatch(
			patternGraph.nodes,
			patternGraph.edges,
			patternGraph.options.type,
			homomorphic,
			nacs
		);

		return matches;
	}

	private calcMaxReplacements(
		matchesCount: number,
		sequenceConfig?: RewritingRuleProcessingConfigSchema
	) {
		if (!sequenceConfig) return 1;
		if (sequenceConfig.options.mode === 'all') {
			return matchesCount;
		} else if (
			sequenceConfig.options.mode === 'interval' &&
			sequenceConfig.options?.interval?.min &&
			sequenceConfig.options?.interval?.max
		) {
			const max = Math.min(sequenceConfig.options.interval.max, matchesCount);
			const min = Math.min(sequenceConfig.options.interval.min, matchesCount);

			return getRandomIntBetween(min, max);
		}
		return 1;
	}

	private getRepetitionOption(
		sequenceConfig?: RewritingRuleProcessingConfigSchema
	) {
		if (!sequenceConfig) return 1;
		if (!sequenceConfig.options) return 1;
		if (!sequenceConfig.options.repeat) return 1;

		if (
			Array.isArray(sequenceConfig.options.repeat) &&
			sequenceConfig.options.repeat.length === 2
		) {
			const min = sequenceConfig.options.repeat[0];
			const max = sequenceConfig.options.repeat[1];
			return getRandomIntBetween(min, max);
		} else if (typeof sequenceConfig.options.repeat === 'number') {
			return sequenceConfig.options.repeat;
		} else {
			throw Error(
				'GraphTransformationService: sequence.options.repeat is not a number or numberArray'
			);
		}
	}

	private getHomomorphicOption(options: GraphRewritingRuleSchema['options']) {
		const useHomomorphic = options?.homomorphic ?? true;
		logger.debug(
			`GraphTransformationService: Using ${useHomomorphic ? 'homomorphic' : 'isomorphic'} matching`
		);
		return useHomomorphic;
	}

	private getNACs(
		patternGraph: GraphRewritingRuleSchema['patternGraph']
	): NacSchema[] {
		return patternGraph.nacs || [];
	}

	private async handleExternalInstantiation(
		match: DBGraphPatternMatchResult,
		replacementGraph: ReplacementGraphSchema | ExternalReplacementGraphConfig
	): Promise<ReplacementGraphSchema> {
		if ('type' in replacementGraph) {
			const instantiatorPlugin = this.instantiatorService.getGraphInstantiator(
				replacementGraph.type
			);
			return await instantiatorPlugin.instantiate({
				match,
				...replacementGraph.args,
			});
		}

		return replacementGraph;
	}

	private async handleMatch(
		match: DBGraphPatternMatchResult,
		patternGraph: PatternGraphSchema,
		replacementGraph: ReplacementGraphSchema | ExternalReplacementGraphConfig
	) {
		replacementGraph = await this.handleExternalInstantiation(
			match,
			replacementGraph
		);

		await this.performInstantiationAndReplacement(
			match,
			patternGraph,
			replacementGraph
		);

		this.updateHistory();
	}

	private async performInstantiationAndReplacement(
		match: DBGraphPatternMatchResult,
		lhs: PatternGraphSchema,
		rhs: ReplacementGraphSchema
	) {
		const rhsInstantiated = this.instantiateAttributes(rhs, match);

		const rewriteService = new SpoRewriteService(this.graphService);
		await rewriteService.performReplacement(match, lhs, rhsInstantiated);
	}

	public async importHostgraph(
		hostgraphData: GraphSchema
	): Promise<ResultGraphSchema> {
		// First delete all previous nodes and edges
		await this.graphService.deleteAllNodes();

		const parser = new GraphologyParserService();
		// graphology requires graph attributes options
		const hostgraph = parser.parseGraph({ ...hostgraphData, attributes: {} });

		// Load the graph into the database
		await this.loadGraphIntoDB(hostgraph);

		return this.exportHostgraph(hostgraphData);
	}

	private async loadGraphIntoDB(
		graph: Graph<GrsGraphNodeMetadata, GrsGraphEdgeMetadata, GrsGraphMetadata>
	) {
		for (const node of graph.nodeEntries()) {
			await this.graphService.createNode(
				node.attributes,
				node.attributes._grs_internalId
			);
		}

		for (const edge of graph.edgeEntries()) {
			await this.graphService.createEdge(
				edge.sourceAttributes._grs_internalId,
				edge.targetAttributes._grs_internalId,
				edge.attributes._grs_internalId,
				edge.attributes
			);
		}
	}

	private async exportHostgraph(
		hostgraph?: GraphSchema
	): Promise<ResultGraphSchema> {
		const nodes = (await this.graphService.getAllNodes()) as GraphNodeSchema[];
		const edges = (await this.graphService.getAllEdges()) as GraphEdgeSchema[];

		let options = this.hostgraphOptions;

		// Options should not have changed from the original hostgraph
		if (hostgraph) {
			options = hostgraph.options;
		}

		return { options, nodes, edges };
	}

	private instantiateAttributes(
		graph: ReplacementGraphSchema,
		match: DBGraphPatternMatchResult
	): ReplacementGraphSchema {
		// clone graph for assignment to make sure attribute is only instantiated for this match
		const instantiatedGraph = structuredClone(graph);

		// the match now has a nodes object with the searchgraph key as property key
		// but for th jsonLogic matching we want the same structure as in the searchgraph
		const formattedMatch: GraphSchema = {
			options: graph.options,
			nodes: [],
			edges: [],
		};

		if (match?.nodes) {
			for (const [key, node] of Object.entries(match.nodes)) {
				const formattedNode = { ...node };
				formattedNode.key = key;
				formattedMatch.nodes.push(formattedNode as GraphNodeSchema);
			}
		}

		if (match?.edges) {
			for (const [key, edge] of Object.entries(match.edges)) {
				const formattedEdge = { ...edge };
				formattedEdge.key = key;
				formattedMatch.edges.push(formattedEdge as GraphEdgeSchema);
			}
		}

		instantiatedGraph.nodes.map((node) => {
			return this.handleAttributeInstantiationForEdgeOrNodeItem(
				node,
				formattedMatch
			);
		});
		instantiatedGraph.edges.map((edge) => {
			return this.handleAttributeInstantiationForEdgeOrNodeItem(
				edge,
				formattedMatch
			);
		});

		return instantiatedGraph;
	}

	private handleAttributeInstantiationForEdgeOrNodeItem(
		item: ReplacementEdgeSchema | ReplacementNodeSchema,
		match: GraphSchema
	) {
		if (item?.attributes) {
			for (const [key, attribute] of Object.entries(item.attributes)) {
				if (attribute === null) continue;
				if (typeof attribute === 'object') {
					const instantiatorPlugin =
						this.instantiatorService.getValueInstantiator(attribute.type);
					item.attributes[key] = instantiatorPlugin.instantiate({
						...attribute.args,
						match,
					});
				}
			}
		}
		return item;
	}

	private async initializeHostGraph(hostgraphData: GraphSchema) {
		logger.debug('GraphTransformationService: Importing Hostgraph.');
		this.hostgraphOptions = hostgraphData.options;
		this.graphService.graphType = hostgraphData.options.type;
		await this.importHostgraph(hostgraphData);
	}

	private async updateHistory() {
		if (this.trackHistory) {
			const currentHostgraph = await this.exportHostgraph();
			this.historyService.addToHistory(currentHostgraph);
		}
	}
}
