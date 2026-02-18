import { GraphSchema } from '../../../types/graph.schema';
import { GraphRewritingRequestSchema } from '../../../types/request-transform.schema';

export const inputHomomorphic: GraphRewritingRequestSchema = {
	hostgraph: {
		options: {
			type: 'directed',
		},
		nodes: [
			{
				key: 'A',
				attributes: {
					label: 'Match Me!',
				},
			},
			{
				key: 'B',
				attributes: {
					label: 'Match Me!',
				},
			},
			{
				key: 'C',
				attributes: {
					label: "Don't Match me!",
				},
			},
		],
		edges: [
			{
				key: 'aToA',
				source: 'A',
				target: 'A',
				attributes: {},
			},
			{
				key: 'aToB',
				source: 'A',
				target: 'B',
				attributes: {},
			},
			{
				key: 'aToC',
				source: 'A',
				target: 'C',
				attributes: {},
			},
		],
	},
	rules: [
		{
			key: 'updateNode',
			options: {
				homomorphic: true,
			},
			patternGraph: {
				options: {
					type: 'directed',
				},
				nodes: [
					{
						key: 'n1',
						attributes: {},
					},
					{
						key: 'n2',
						attributes: {
							label: 'Match Me!',
						},
					},
				],
				edges: [
					{
						key: 'e1',
						source: 'n1',
						target: 'n2',
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
						key: 'n1',
						attributes: {},
					},
					{
						key: 'n2',
						attributes: {
							label: "I've been replaced!",
						},
					},
				],
				edges: [
					{
						key: 'e1',
						source: 'n1',
						target: 'n2',
						attributes: {},
					},
				],
			},
		},
	],
	sequence: [
		{
			rule: 'updateNode',
			options: {
				mode: 'all',
			},
		},
	],
};

const isomorphic = structuredClone(inputHomomorphic);
isomorphic.rules![0].options!.homomorphic = false;
export const inputIsomorphic = isomorphic;

export const expectedOutputHomomorphic: GraphSchema = {
	options: {
		type: 'directed',
	},
	nodes: [
		{
			key: 'n_1',
			attributes: {
				label: "I've been replaced!",
			},
		},
		{
			key: 'n_2',
			attributes: {
				label: "I've been replaced!",
			},
		},
		{
			key: 'n_3',
			attributes: {
				label: "Don't Match me!",
			},
		},
	],
	edges: [
		{
			key: 'e_1',
			source: 'n_1',
			target: 'n_1',
			attributes: {},
		},
		{
			key: 'e_2',
			source: 'n_1',
			target: 'n_2',
			attributes: {},
		},
		{
			key: 'e_3',
			source: 'n_1',
			target: 'n_3',
			attributes: {},
		},
	],
};

export const expectedOutputIsomorphic: GraphSchema = {
	options: {
		type: 'directed',
	},
	nodes: [
		{
			key: 'n_1',
			attributes: {
				label: 'Match Me!',
			},
		},
		{
			key: 'n_2',
			attributes: {
				label: "I've been replaced!",
			},
		},
		{
			key: 'n_3',
			attributes: {
				label: "Don't Match me!",
			},
		},
	],
	edges: [
		{
			key: 'e_1',
			source: 'n_1',
			target: 'n_1',
			attributes: {},
		},
		{
			key: 'e_2',
			source: 'n_1',
			target: 'n_2',
			attributes: {},
		},
		{
			key: 'e_3',
			source: 'n_1',
			target: 'n_3',
			attributes: {},
		},
	],
};
