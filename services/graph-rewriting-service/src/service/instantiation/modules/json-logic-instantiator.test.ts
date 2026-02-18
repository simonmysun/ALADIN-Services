import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
	JsonLogicInstantiator,
	JsonLogicErrors,
	JsonLogicInstantiatorOptions,
	JsonPathErrors,
} from './json-logic-instantiator';
import { RulesLogic } from 'json-logic-js';
import { GraphSchema } from '../../../types/request-transform.schema';
import { logger } from '../../../utils/logger';

const logDebugSpy = vi.spyOn(logger, 'debug');

describe('JsonLogicInstantiator', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test('Should return the instantiator key', () => {
		const instantiator = new JsonLogicInstantiator();
		expect(instantiator.instantiatorKey).toBe('jsonLogic');
	});

	test('Should return the "then" value of the first rule with a positive result', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'a' },
			},
		];

		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': [
						'$.nodes.[?(@.key === "node1")].attributes.attributeName',
						'b',
					],
				},
				'value1',
				{
					'==': [
						'$.nodes.[?(@.key === "node2")].attributes.attributeName',
						'a',
					],
				},
				'value2',
			],
		};

		const args: JsonLogicInstantiatorOptions = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		};
		const result = instantiator.instantiate(args);
		expect(result).toBe('value2');
	});

	test('Should return an empty string if no rules have a positive result', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'a' },
			},
		];

		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': [
						'$.nodes.[?(@.key === "node1")].attributes.attributeName',
						'b',
					],
				},
				'value1',
				{
					'==': [
						'$.nodes.[?(@.key === "node2")].attributes.attributeName',
						'c',
					],
				},
				'value2',
			],
		};

		const args: JsonLogicInstantiatorOptions = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		};
		const result = instantiator.instantiate(args);
		expect(result).toBe('');
	});

	test('Should resolve search graph values correctly', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'attributeValue' },
			},
		];

		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': [
						'$.nodes.[?(@.key === "node1")].attributes.attributeName',
						'attributeValue',
					],
				},
				'instantiatedAttributeValue',
			],
		};

		const args: JsonLogicInstantiatorOptions = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		};
		const result = instantiator.instantiate(args);
		expect(result).toBe('instantiatedAttributeValue');
	});

	test('Should resolve nested search graph values correctly', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'b' },
			},
		];

		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		let rule = {
			if: [
				{
					and: [
						{
							'==': [
								'$.nodes.[?(@.key === "node1")].attributes.attributeName',
								'a',
							],
						},
						{
							'==': [
								'$.nodes.[?(@.key === "node2")].attributes.attributeName',
								'b',
							],
						},
					],
				},
				'trueInstantiatedAttributeValue',
				'falseInstantiatedAttributeValue',
			],
		};

		let args: JsonLogicInstantiatorOptions = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		};
		let result = instantiator.instantiate(args);
		expect(result).toBe('trueInstantiatedAttributeValue');

		// This one should return the empty string value as the condition is *not* correct
		rule = {
			if: [
				{
					and: [
						{
							'==': [
								'$.nodes.[?(@.key === "node1")].attributes.attributeName',
								'a',
							],
						},
						{
							'==': [
								'$.nodes.[?(@.key === "node2")].attributes.attributeName',
								'a',
							],
						},
					],
				},
				'trueInstantiatedAttributeValue',
				'falseInstantiatedAttributeValue',
			],
		};

		args = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		};
		result = instantiator.instantiate(args);
		expect(result).toBe('falseInstantiatedAttributeValue');
	});

	test('Should resolve jsonLogic rules with data object', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'b' },
			},
		];

		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					and: [
						{
							'==': [
								'$.nodes.[?(@.key === "node1")].attributes.attributeName',
								'a',
							],
						},
						{ '==': [{ var: 'hello' }, 'world'] },
						{ '==': [{ var: 'test.nested' }, 'successful'] },
					],
				},
				'trueInstantiatedAttributeValue',
				'falseInstantiatedAttributeValue',
			],
		};

		const args: JsonLogicInstantiatorOptions = {
			rule: rule as RulesLogic,
			match: match as GraphSchema,
			data: {
				hello: 'world',
				test: { nested: 'successful' },
			},
		};
		const result = instantiator.instantiate(args);
		expect(result).toBe('trueInstantiatedAttributeValue');
	});

	test('Should throw error if rules are not provided', () => {
		const instantiator = new JsonLogicInstantiator();
		expect(() =>
			// @ts-expect-error: Parameters are not as typed
			instantiator.instantiate({
				match: {} as GraphSchema,
			})
		).toThrowError(JsonLogicErrors.RulesNotProvided);
	});

	test('Should throw error if match is not provided', () => {
		const instantiator = new JsonLogicInstantiator();
		expect(() =>
			// @ts-expect-error: Parameters are not as typed
			instantiator.instantiate({
				rule: {} as RulesLogic,
			})
		).toThrowError(JsonLogicErrors.MatchNotProvided);
	});

	// test('Should throw error if no "if" condition is provided in a rule', () => {
	// 	const instantiator = new JsonLogicInstantiator();
	// 	const rules = [{ then: 'value', data: {} }];
	// 	expect(() =>
	// 		instantiator.instantiate({
	// 			// @ts-expect-error: Parameters are not as typed
	// 			rules,
	// 			matchesMap: new Map(),
	// 		})
	// 	).toThrowError(JsonLogicErrors.IncompleteRuleConfig);
	// });

	test('Should throw error if jsonLogic fails', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'b' },
			},
		];
		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			nonexistentOperator: [
				{
					'==': [
						'$.nodes.[?(@.key === "node1")].attributes.attributeName',
						'attributeValue',
					],
				},
				'instantiatedAttributeValue',
			],
		};

		expect(() =>
			instantiator.instantiate({
				// @ts-expect-error: Parameters are not as typed
				rule: rule as RulesLogic,
				match: match as GraphSchema,
			})
		).toThrowError(JsonLogicErrors.EvaluationFailed);
	});

	test('Should return empty string referenced node attribute is not found in the matches map', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'b' },
			},
		];
		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': [
						'$.nodes.[?(@.key === "test")].attributes.attributeName',
						'attributeValue',
					],
				},
				'instantiatedAttributeValue',
			],
		};

		const result = instantiator.instantiate({
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		});
		expect(result).toBe('');

		expect(logDebugSpy).toHaveBeenCalled();
		expect(logDebugSpy).toHaveBeenCalledWith(
			'JsonLogicInstantiator: JSON Path \'$.nodes.[?(@.key === "test")].attributes.attributeName\' not found in searchgraph match'
		);
	});

	test('Should throw error if a referenced node is ambigous', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
			{
				key: 'node2',
				attributes: { attributeName: 'b' },
			},
		];
		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': ['$.nodes..attributes.attributeName', 'attributeValue'],
				},
				'instantiatedAttributeValue',
			],
		};

		expect(() =>
			instantiator.instantiate({
				rule: rule as RulesLogic,
				match: match as GraphSchema,
			})
		).toThrowError(JsonPathErrors.PathAmbigous);
	});

	test('Should return empty string if referenced node is not formatted correctly', () => {
		const instantiator = new JsonLogicInstantiator();
		const matchNodes = [
			{
				key: 'node1',
				attributes: { attributeName: 'a' },
			},
		];
		const match: Partial<GraphSchema> = {
			nodes: matchNodes,
			edges: [],
		};

		const rule = {
			if: [
				{
					'==': ['$.node.attributes.attributeName', 'attributeValue'],
				},
				'instantiatedAttributeValue',
			],
		};

		const result = instantiator.instantiate({
			rule: rule as RulesLogic,
			match: match as GraphSchema,
		});
		expect(result).toBe('');

		expect(logDebugSpy).toHaveBeenCalled();
		expect(logDebugSpy).toHaveBeenCalledWith(
			"JsonLogicInstantiator: JSON Path '$.node.attributes.attributeName' not found in searchgraph match"
		);
	});
});
