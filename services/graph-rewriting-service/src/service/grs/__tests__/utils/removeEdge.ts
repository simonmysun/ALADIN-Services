import { GraphRewritingRequestSchema } from '../../../types/request-transform.schema';
import { GraphSchema } from '../../../types/graph.schema';

export const input: GraphRewritingRequestSchema = {
	hostgraph: {
		options: {
			type: 'directed',
		},
		nodes: [
			{
				key: 'A',
				attributes: {
					label: 'A',
					type: 'Event',
				},
			},
			{
				key: 'B',
				attributes: {
					label: 'B',
					type: 'Function',
				},
			},
			{
				key: 'C',
				attributes: {
					label: 'C',
					type: 'Event',
				},
			},
		],
		edges: [
			{
				key: 'aToB',
				source: 'A',
				target: 'B',
				attributes: {},
			},
			{
				key: 'bToC',
				source: 'B',
				target: 'C',
				attributes: {},
			},
		],
	},
	rules: [
		{
			key: 'remove_edge',
			patternGraph: {
				options: {
					type: 'directed',
				},
				nodes: [
					{
						key: 'B',
						attributes: {
							label: 'B',
							type: 'Function',
						},
					},
				],
				edges: [
					{
						key: 'bToC',
						source: 'B',
						target: 'C',
						attributes: {},
					},
				],
			},
			replacementGraph: {
				options: {
					type: 'directed',
				},
				nodes: [
					{
						key: 'B',
						attributes: {
							label: 'B',
							type: 'Function',
						},
					},
				],
				edges: [],
			},
		},
	],
};

export const expectedOutput: GraphSchema = {
	options: {
		type: 'directed',
	},
	nodes: [
		{
			key: 'n_1',
			attributes: {
				label: 'A',
				type: 'Event',
			},
		},
		{
			key: 'n_2',
			attributes: {
				label: 'B',
				type: 'Function',
			},
		},
		{
			key: 'n_3',
			attributes: {
				label: 'C',
				type: 'Event',
			},
		},
	],
	edges: [
		{
			key: 'e_1',
			source: 'n_1',
			target: 'n_2',
			attributes: {},
		},
	],
};
