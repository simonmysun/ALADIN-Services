import neo4j, { Driver, ManagedTransaction, Session } from 'neo4j-driver';
import { Neo4jContainer, StartedNeo4jContainer } from '@testcontainers/neo4j';

import {
	vi,
	expect,
	test,
	describe,
	beforeAll,
	afterAll,
	beforeEach,
	afterEach,
} from 'vitest';

import { Neo4jGraphService } from './graph.service';
import { getApocJsonAllExport } from './testutils/helpers';
import { createParameterUuid } from '../../../utils/uuid';
import { PatternNodeSchema } from '../../../types/patternnode.schema';
import { DBGraphNACs } from '../types';
import { PatternEdgeSchema } from '../../../types/patternedge.schema';

let container: StartedNeo4jContainer;
let driver: Driver;
let session: Session;

vi.mock('../../../utils/uuid');

describe('Integration tests for graph service with testcontainers', () => {
	beforeAll(async () => {
		container = await new Neo4jContainer('neo4j:5.25.1').withApoc().start();

		driver = neo4j.driver(
			container.getBoltUri(),
			neo4j.auth.basic(container.getUsername(), container.getPassword())
		);
	}, 30000);

	beforeEach(async () => {
		session = driver.session();
	});

	afterEach(async () => {
		// Delete all nodes & relationships
		await session.run(`MATCH (n) CALL (n) { DETACH DELETE n } IN TRANSACTIONS`);
		// Drop all indexes & constraints
		await session.run(`CALL apoc.schema.assert({}, {})`);
		await session.close();
	});

	afterAll(async () => {
		await driver.close();
		await container.stop();
	});

	describe('Graph creation & editing', () => {
		test('Test createNode', async () => {
			const testProperties = [
				{ hello: 'world' },
				{ hello: 'world', test: 'testMe' },
				{},
				{ type: 'Gate', test: 'testMe' },
			];
			const testKey = ['testnode1', '', 'testnode3', 'testnode4'];
			const expectedResult = [
				{
					key: testKey[0],
					attributes: {
						...testProperties[0],
					},
				},
				{
					key: testKey[1],
					attributes: {
						...testProperties[1],
					},
				},
				{
					key: testKey[2],
					attributes: {},
				},
				{
					key: testKey[3],
					attributes: {
						...testProperties[3],
					},
				},
			];

			const graphService = new Neo4jGraphService(session);

			for (let index = 0; index < testProperties.length; index++) {
				const neo4jSpy = vi.spyOn(session, 'executeWrite');

				const result = await graphService.createNode(
					{ ...testProperties[index], _grs_internalId: testKey[index] },
					testKey[index]
				);
				expect(result).toEqual(expectedResult[index]);
				expect(neo4jSpy).toHaveBeenCalled();
				// should have been called once for each node
				// plus twice for the constraints on the first run
				if (index === 0) {
					expect(neo4jSpy).toHaveBeenCalledTimes(3);
				} else {
					expect(neo4jSpy).toHaveBeenCalledTimes(1);
				}
			}

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			expect(finalNodesCount.toNumber()).toEqual(testKey.length);
		}, 10000);

		test('Test createNode should fail for duplicate key', async () => {
			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');

			await graphService.createNode({ hello: 'world' }, 'testnode1');

			await expect(() =>
				graphService.createNode({ hello: 'world' }, 'testnode1')
			).rejects.toThrowError();

			expect(neo4jSpy).toHaveBeenCalled();
			// should have beeen called once for each node
			// plus twice to set constraints
			expect(neo4jSpy).toHaveBeenCalledTimes(4);
		}, 10000);

		test('Test getNode', async () => {
			// Prime database with a test node
			await session.run(
				`CREATE (n:Node {label: 'Test', _grs_internalId: 'testnode1'})`
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.getNode('testnode1');
			expect(result).toEqual({
				key: 'testnode1',
				attributes: {
					label: 'Test',
				},
			});
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
		}, 10000);

		test('Test updateNode', async () => {
			// Prime database with a test node
			await session.run(
				`CREATE (n:Node {label: 'Test', _grs_internalId: 'testnode1'})`
			);

			// Setup test
			const graphService = new Neo4jGraphService(session);
			const updatedNodeData = {
				metadata: {
					label: null,
					hello: 'world',
				},
				internalId: 'testnode1',
			};
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.updateNode(
				updatedNodeData.metadata,
				updatedNodeData.internalId
			);
			expect(result).toEqual({
				key: 'testnode1',
				attributes: {
					hello: 'world',
				},
			});
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
		}, 10000);

		test('Test getAllNodes', async () => {
			// Add testdata to database
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
					{ label: 'C', key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.getAllNodes();

			expect(result).toEqual(
				expect.arrayContaining([
					{
						key: 'testnodeA',
						attributes: {
							label: 'A',
						},
					},
					{
						key: 'testnodeB',
						attributes: {
							label: 'B',
						},
					},
					{
						key: 'testnodeC',
						attributes: {
							label: 'C',
						},
					},
				])
			);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
		}, 10000);

		test('Test deleteNode', async () => {
			// Add testdata to database
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
					{ label: 'C', key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.deleteNode('testnodeA');
			// Check result
			expect(result).toBeUndefined();
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			const finalData = finalState.records[0].get('data');
			expect(finalNodesCount.toNumber()).toEqual(2);
			expect(finalData).not.toContainEqual(
				expect.objectContaining({
					properties: expect.objectContaining({
						label: 'A',
						_grs_internalId: 'testnodeA',
					}),
				})
			);
		});

		test('Test deleteNodes', async () => {
			// Add testdata to database
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
					{ label: 'C', key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.deleteNodes(['testnodeA', 'testnodeB']);
			// Check result
			expect(result).toStrictEqual([]);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			const finalData = finalState.records[0].get('data');
			expect(finalNodesCount.toNumber()).toEqual(1);
			expect(finalData).not.toContainEqual(
				expect.objectContaining({
					properties: expect.objectContaining({
						label: 'A',
						_grs_internalId: 'testnodeA',
					}),
				})
			);
			expect(finalData).not.toContainEqual(
				expect.objectContaining({
					properties: expect.objectContaining({
						label: 'B',
						_grs_internalId: 'testnodeB',
					}),
				})
			);
		});

		test('Test deleteAllNodes', async () => {
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
					{ label: 'C', key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'run');
			const result = await graphService.deleteAllNodes();
			// Check result
			expect(result).toEqual([]);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			expect(finalNodesCount.toNumber()).toEqual(0);
		});

		test('Test createEdge', async () => {
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.createEdge(
				'testnodeA',
				'testnodeB',
				'testrelation',
				{ type: 'relation', hello: 'world' }
			);
			// Check result
			expect(result).toEqual({
				key: 'testrelation',
				source: 'testnodeA',
				target: 'testnodeB',
				attributes: {
					type: 'relation',
					hello: 'world',
				},
			});
			expect(neo4jSpy).toHaveBeenCalled();
			// should have been called once for edge
			// plus twice for the constraints
			expect(neo4jSpy).toHaveBeenCalledTimes(2 + 1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalEdgesCount = finalState.records[0].get('relationships');
			expect(finalEdgesCount.toNumber()).toEqual(1);
		});

		test('Test createEdge should fail for duplicate key', async () => {
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);

			const graphService = new Neo4jGraphService(session);
			await graphService.createEdge('testnodeA', 'testnodeB', 'testrelation', {
				type: 'relation',
				hello: 'world',
			});

			await expect(() =>
				graphService.createEdge('testnodeA', 'testnodeB', 'testrelation', {})
			).rejects.toThrowError();
		});

		test('Test getEdge', async () => {
			// Prime database with nodes & relationship
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
		CREATE (n:Node {label: config.label, _grs_internalId: config.key})`,
				props
			);
			await session.run(`MATCH (a),(b) \
		WHERE a._grs_internalId = 'testnodeA' \
		AND b._grs_internalId = 'testnodeB' \
		CREATE (a)-[r:\`_grs_relationship\` {_grs_internalId: 'testedge', _grs_source: 'testnodeA', _grs_target: 'testnodeB', hello: 'world'}]->(b) RETURN r`);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.getEdge('testedge');
			expect(result).toEqual({
				key: 'testedge',
				source: 'testnodeA',
				target: 'testnodeB',
				attributes: {
					hello: 'world',
				},
			});
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
		}, 10000);

		test('Test deleteEdge', async () => {
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:GRS_NODE {label: config.label, _grs_internalId: config.key})`,
				props
			);
			await session.run(`MATCH (a),(b) \
			WHERE a._grs_internalId = 'testnodeA' \
			AND b._grs_internalId = 'testnodeB' \
			CREATE (a)-[r:\`GRS_relationship\` {_grs_internalId: 'testedge', _grs_source: 'testnodeA', _grs_target: 'testnodeB', hello: 'world'}]->(b) RETURN r`);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.deleteEdge('testedge');
			// Check result
			expect(result).toBeUndefined();
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			const finalEdgesCount = finalState.records[0].get('relationships');
			expect(finalEdgesCount.toNumber()).toEqual(0);
			expect(finalNodesCount.toNumber()).toEqual(2);

			// Todo: check if the specific edge doesn't still exist
		});

		test('Test deleteEdges', async () => {
			const props = {
				attributes: [
					{ label: 'A', key: 'testnodeA' },
					{ label: 'B', key: 'testnodeB' },
					{ label: 'C', key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:GRS_NODE {label: config.label, _grs_internalId: config.key})`,
				props
			);
			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'testedge1' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'testedge2' },
					{ source: 'testnodeB', target: 'testnodeC', key: 'testedge3' },
				],
			};

			await session.run(
				`
			UNWIND $config AS config \
			MATCH (a),(b) \
			WHERE a._grs_internalId = config.source \
			AND b._grs_internalId = config.target \
			CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeWrite');
			const result = await graphService.deleteEdges(['testedge1', 'testedge2']);
			// Check result
			expect(result).toStrictEqual([]);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);

			// Check that database contains the correct data
			const finalState = await getApocJsonAllExport(session);
			const finalNodesCount = finalState.records[0].get('nodes');
			const finalEdgesCount = finalState.records[0].get('relationships');
			expect(finalEdgesCount.toNumber()).toEqual(1);
			expect(finalNodesCount.toNumber()).toEqual(3);

			// Todo: check if the specific edge doesn't still exist
		});

		// TOOD: Add tests for edge cases
		test.todo('Test node not found');
		test.todo("Test node can't be deleted due to remaining edges");
		test.todo('Test edge not found');
		test.todo('Test node updated');
		test.todo('Test edge updated');
	});

	describe('Pattern Matching', () => {
		test('Test pattern matching for single node', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ key: 'testnodeA' },
					{ key: 'testnodeB' },
					{ key: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:GRS_Node {_grs_internalId: config.key})`,
				nodeProps
			);

			const patternNodes = [
				{
					key: 'A',
					attributes: {},
				},
			];

			// Should match each individual node
			const expectedResultSet = [
				{
					edges: {},
					nodes: {
						A: {
							attributes: {},
							key: 'testnodeA',
						},
					},
				},
				{
					edges: {},
					nodes: {
						A: {
							attributes: {},
							key: 'testnodeB',
						},
					},
				},
				{
					edges: {},
					nodes: {
						A: {
							attributes: {},
							key: 'testnodeC',
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(patternNodes, []);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSet.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		}, 10000);

		test('Test pattern matching for single node with attributes', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', hello: 'world' },
					{ _grs_internalId: 'testnodeB', test: 'test2' },
					{ _grs_internalId: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
			CREATE (n:GRS_Node) \
			SET n = config`,
				nodeProps
			);

			const patternNodes = [
				{
					key: 'A',
					attributes: {
						test: 'test2',
					},
				},
			];

			// Should only match node with key "A" as it has the correct attributes
			const expectedResultSets = [
				{
					edges: {},
					nodes: {
						A: {
							attributes: {
								test: 'test2',
							},
							key: 'testnodeB',
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(patternNodes, []);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		}, 10000);

		test('Test pattern matching for single edge', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', hello: 'world' },
					{ _grs_internalId: 'testnodeB', test: 'test2' },
					{ _grs_internalId: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:GRS_Node) \
				SET n = config`,
				nodeProps
			);

			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'testedge1' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'testedge2' },
				],
			};

			await session.run(
				`
			UNWIND $config AS config \
			MATCH (a),(b) \
			WHERE a._grs_internalId = config.source \
			AND b._grs_internalId = config.target \
			CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const patternEdges = [
				{
					key: 'edge',
					source: 'A',
					target: 'B',
					attributes: {},
				},
			];

			// Should only match edge
			const expectedResultSets = [
				{
					edges: {
						edge: {
							attributes: {},
							key: 'testedge1',
							source: 'testnodeA',
							target: 'testnodeB',
						},
					},
					nodes: {},
				},
				{
					edges: {
						edge: {
							attributes: {},
							key: 'testedge2',
							source: 'testnodeA',
							target: 'testnodeC',
						},
					},
					nodes: {},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch([], patternEdges);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		}, 10000);

		test('Test pattern matching for two connected nodes', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', hello: 'world' },
					{ _grs_internalId: 'testnodeB', test: 'test2' },
					{ _grs_internalId: 'testnodeC' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:GRS_Node) \
				SET n = config`,
				nodeProps
			);

			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'testedge1' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'testedge2' },
				],
			};

			await session.run(
				`
			UNWIND $config AS config \
			MATCH (a),(b) \
			WHERE a._grs_internalId = config.source \
			AND b._grs_internalId = config.target \
			CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const patternNodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {},
				},
			];

			const patternEdges = [
				{
					key: 'edge',
					source: 'A',
					target: 'B',
					attributes: {},
				},
			];

			// Should have two resultsets with A-B and A-C
			const expectedResultSets = [
				{
					edges: {
						edge: {
							attributes: {},
							key: 'testedge1',
							source: 'testnodeA',
							target: 'testnodeB',
						},
					},
					nodes: {
						A: {
							key: 'testnodeA',
							attributes: {
								hello: 'world',
							},
						},
						B: {
							key: 'testnodeB',
							attributes: {
								test: 'test2',
							},
						},
					},
				},
				{
					edges: {
						edge: {
							attributes: {},
							key: 'testedge2',
							source: 'testnodeA',
							target: 'testnodeC',
						},
					},
					nodes: {
						A: {
							key: 'testnodeA',
							attributes: {
								hello: 'world',
							},
						},
						B: {
							key: 'testnodeC',
							attributes: {},
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(
				patternNodes,
				patternEdges,
				'directed'
			);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		}, 10000);

		test.todo('Test pattern matching for simple pattern');
		test.todo('Test pattern matching for complex pattern');
		test('Test pattern matching for nacs: excluding attribute', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', hello: 'world' },
					{ _grs_internalId: 'testnodeB', test: 'wert' },
					{ _grs_internalId: 'testnodeC', hello: 'world' },
					{ _grs_internalId: 'testnodeD', attribute: 'value' },
					{ _grs_internalId: 'testnodeE' },
					{ _grs_internalId: 'testnodeF' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:GRS_Node) \
				SET n = config`,
				nodeProps
			);

			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'aToB' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'aToC' },
					{ source: 'testnodeC', target: 'testnodeD', key: 'cToD' },
					{ source: 'testnodeD', target: 'testnodeE', key: 'dToE' },
					{ source: 'testnodeE', target: 'testnodeC', key: 'eToC' },
					{ source: 'testnodeA', target: 'testnodeF', key: 'aToF' },
				],
			};

			await session.run(
				`UNWIND $config AS config \
				MATCH (a),(b) \
				WHERE a._grs_internalId = config.source \
				AND b._grs_internalId = config.target \
				CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const patternNodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {},
				},
			];

			const patternEdges = [
				{
					key: 'edge',
					source: 'A',
					target: 'B',
					attributes: {},
				},
			];

			const nacs = [
				{
					nodes: [
						{
							key: 'A',
							attributes: {
								hello: 'world',
							},
						},
					],
					edges: [],
				},
			];

			// Should have two resultsets with A-B and A-C
			const expectedResultSets = [
				{
					edges: {
						edge: {
							attributes: {},
							key: 'dToE',
							source: 'testnodeD',
							target: 'testnodeE',
						},
					},
					nodes: {
						A: {
							key: 'testnodeD',
							attributes: {
								attribute: 'value',
							},
						},
						B: {
							key: 'testnodeE',
							attributes: {},
						},
					},
				},
				{
					edges: {
						edge: {
							attributes: {},
							key: 'eToC',
							source: 'testnodeE',
							target: 'testnodeC',
						},
					},
					nodes: {
						A: {
							key: 'testnodeE',
							attributes: {},
						},
						B: {
							key: 'testnodeC',
							attributes: {
								hello: 'world',
							},
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(
				patternNodes,
				patternEdges,
				'directed',
				false,
				nacs
			);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		});

		test('Test pattern matching for nacs: exclude node with connection to NAC-Node', async () => {
			// Set up test database with four nodes.
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', name: 'A' },
					{ _grs_internalId: 'testnodeB', name: 'B' },
					{ _grs_internalId: 'testnodeC', name: 'C' },
					{ _grs_internalId: 'testnodeD', name: 'D' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:GRS_Node) \
				SET n = config`,
				nodeProps
			);

			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'aToB' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'aToC' },
					{ source: 'testnodeA', target: 'testnodeD', key: 'aToD' },
					{ source: 'testnodeC', target: 'testnodeB', key: 'cToB' },
				],
			};

			await session.run(
				`UNWIND $config AS config \
				MATCH (a),(b) \
				WHERE a._grs_internalId = config.source \
				AND b._grs_internalId = config.target \
				CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const patternNodes = [
				{
					key: 'node1',
					attributes: {},
				},
				{
					key: 'node2',
					attributes: {},
				},
			];

			const patternEdges = [
				{
					key: 'edge',
					source: 'node1',
					target: 'node2',
					attributes: {},
				},
			];

			const nacs = [
				{
					options: {
						type: 'directed',
					},
					nodes: [
						{
							key: 'node2',
						},
						{
							key: 'node3',
							attributes: {
								name: 'B',
							},
						},
					],
					edges: [
						{
							key: 'edge2',
							source: 'node2',
							target: 'node3',
							attributes: {},
						},
					],
				},
			];

			// The result should only match the connections A->B, A->D and C->B
			// but NOT A->C, because C is connected to a Node B, which is excluded via NACs
			const expectedResultSets = [
				{
					edges: {
						edge: {
							attributes: {},
							key: 'aToB',
							source: 'testnodeA',
							target: 'testnodeB',
						},
					},
					nodes: {
						node1: {
							key: 'testnodeA',
							attributes: {
								name: 'A',
							},
						},
						node2: {
							key: 'testnodeB',
							attributes: {
								name: 'B',
							},
						},
					},
				},
				{
					edges: {
						edge: {
							attributes: {},
							key: 'aToD',
							source: 'testnodeA',
							target: 'testnodeD',
						},
					},
					nodes: {
						node1: {
							key: 'testnodeA',
							attributes: {
								name: 'A',
							},
						},
						node2: {
							key: 'testnodeD',
							attributes: {
								name: 'D',
							},
						},
					},
				},
				{
					edges: {
						edge: {
							attributes: {},
							key: 'cToB',
							source: 'testnodeC',
							target: 'testnodeB',
						},
					},
					nodes: {
						node1: {
							key: 'testnodeC',
							attributes: {
								name: 'C',
							},
						},
						node2: {
							key: 'testnodeB',
							attributes: {
								name: 'B',
							},
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(
				patternNodes,
				patternEdges,
				'directed',
				false,
				nacs as DBGraphNACs[]
			);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		});

		test('Test pattern matching for nacs: excluding node with two outgoing edges to any nodes', async () => {
			// Set up test database with two nodes
			const nodeProps = {
				attributes: [
					{ _grs_internalId: 'testnodeA', name: 'A' },
					{ _grs_internalId: 'testnodeB', name: 'B' },
					{ _grs_internalId: 'testnodeC', name: 'C' },
					{ _grs_internalId: 'testnodeD', name: 'D' },
				],
			};
			await session.run(
				`UNWIND $attributes AS config \
				CREATE (n:GRS_Node) \
				SET n = config`,
				nodeProps
			);

			const edgesProps = {
				config: [
					{ source: 'testnodeA', target: 'testnodeB', key: 'aToB' },
					{ source: 'testnodeA', target: 'testnodeC', key: 'aToC' },
					{ source: 'testnodeA', target: 'testnodeD', key: 'aToD' },

					{ source: 'testnodeB', target: 'testnodeA', key: 'bToA' },
					{ source: 'testnodeB', target: 'testnodeC', key: 'bToC' },

					{ source: 'testnodeC', target: 'testnodeB', key: 'cToB' },
				],
			};

			await session.run(
				`UNWIND $config AS config \
				MATCH (a),(b) \
				WHERE a._grs_internalId = config.source \
				AND b._grs_internalId = config.target \
				CREATE (a)-[r:\`GRS_Relationship\` {_grs_internalId: config.key, _grs_source: config.source, _grs_target: config.target}]->(b) RETURN r`,
				edgesProps
			);

			const patternNodes = [
				{
					key: 'node1',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const patternEdges: PatternEdgeSchema[] = [];

			const nacs = [
				{
					options: {
						type: 'directed',
					},
					nodes: [
						{
							key: 'node1',
						},
						{
							key: 'node2',
						},
						{
							key: 'node3',
						},
					],
					edges: [
						{
							key: 'edge2',
							source: 'node1',
							target: 'node2',
							attributes: {},
						},
						{
							key: 'edge3',
							source: 'node1',
							target: 'node3',
							attributes: {},
						},
					],
				},
			];

			// The result should only match the nodes C and D
			// Because A and B have multiple outgoing edges
			const expectedResultSets = [
				{
					edges: {},
					nodes: {
						node1: {
							key: 'testnodeC',
							attributes: {
								name: 'C',
							},
						},
					},
				},
				{
					edges: {},
					nodes: {
						node1: {
							key: 'testnodeD',
							attributes: {
								name: 'D',
							},
						},
					},
				},
			];

			const graphService = new Neo4jGraphService(session);
			const neo4jSpy = vi.spyOn(session, 'executeRead');
			const result = await graphService.findPatternMatch(
				patternNodes,
				patternEdges,
				'directed',
				false,
				nacs as DBGraphNACs[]
			);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(neo4jSpy).toHaveBeenCalledTimes(1);
			expectedResultSets.forEach((expectedResultNode) => {
				expect(result).toContainEqual(expectedResultNode);
			});
		});
	});
});

describe('Unit tests for graph service with mocked neo4j functions', () => {
	let mockSession: Session;
	let mockTx: ManagedTransaction;
	let graphService: Neo4jGraphService;

	beforeEach(() => {
		mockTx = {
			run: vi.fn(),
		} as unknown as ManagedTransaction;

		mockSession = {
			executeRead: vi.fn(
				(callback: (tx: ManagedTransaction) => Promise<never>) =>
					callback(mockTx)
			),
			executeWrite: vi.fn(
				(callback: (tx: ManagedTransaction) => Promise<never>) =>
					callback(mockTx)
			),
		} as unknown as Session;

		graphService = new Neo4jGraphService(mockSession);
		graphService.mapPatternMatchToResult = vi.fn();

		vi.resetAllMocks();
		let paramCount = 0;
		vi.mocked(createParameterUuid).mockImplementation(() => {
			paramCount++;
			return `p_${paramCount}`;
		});
	});

	afterEach(async () => {
		vi.clearAllMocks();
	});

	// Tests for pattern matching
	describe('Test pattern matching cypher query strings', () => {
		test('Match single node', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, []);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`) RETURN A',
				{}
			);
		});

		test('Match two nodes with attribute(s)', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {
						test: 'hello world',
						type: 'NodeTypeA',
					},
				},
				{
					key: 'B',
					attributes: {
						test: 'hello world',
						numberAttribute: 1,
					},
				},
			] as PatternNodeSchema[];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, []);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`) WHERE A.test = $p_1 AND A.type = $p_2 AND B.test = $p_3 AND B.numberAttribute = $p_4 RETURN A, B',
				{
					p_1: 'hello world',
					p_2: 'NodeTypeA',
					p_3: 'hello world',
					p_4: 1,
				}
			);
		});

		test('Match nodes with injectivity constraint set', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {
						test: 'hello world',
					},
				},
				{
					key: 'C',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
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
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'undirected', false);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (`C`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]-(B), (A)-[`aToC`:GRS_Relationship]-(C) WHERE `A` <> `B` AND `A` <> `C` AND `B` <> `C` AND `aToB` <> `aToC` AND B.test = $p_1 RETURN A, B, C, aToB, aToC',
				{
					p_1: 'hello world',
				}
			);
		});

		test('Match two nodes with no edge', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {},
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, []);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`) RETURN A, B',
				{}
			);
		});

		test('Match single edge with attributes', async () => {
			// test case pattern
			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {
						hello: 'world',
						attribute: 'value',
					},
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch([], edges);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (A)-[`aToB`:GRS_Relationship]-(B) WHERE aToB.hello = $p_1 AND aToB.attribute = $p_2 RETURN aToB',
				{
					p_1: 'world',
					p_2: 'value',
				}
			);
		});

		test('Match two nodes with undirected edge', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {},
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]-(B) RETURN A, B, aToB',
				{}
			);
		});

		test('Match two nodes with directed edge', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {},
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'directed');
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]->(B) RETURN A, B, aToB',
				{}
			);
		});

		test('Match simple pattern', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {
						type: 'BType',
					},
				},
				{
					key: 'C',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {
						type: 'edge connector',
					},
				},
				{
					key: 'bToC',
					source: 'B',
					target: 'C',
					attributes: {},
				},
			] as PatternEdgeSchema[];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'directed');
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (`C`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]->(B), (B)-[`bToC`:GRS_Relationship]->(C) WHERE B.type = $p_1 AND aToB.type = $p_2 RETURN A, B, C, aToB, bToC',
				{ p_1: 'BType', p_2: 'edge connector' }
			);
		});

		test('Match simple pattern with NACs', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {
						type: 'BType',
					},
				},
				{
					key: 'C',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {
						type: 'edge connector',
					},
				},
				{
					key: 'bToC',
					source: 'B',
					target: 'C',
					attributes: {},
				},
			] as PatternEdgeSchema[];

			const nacs = [
				{
					nodes: [
						{
							key: 'C',
							attributes: {
								test: 'value',
							},
						},
					],
					edges: [],
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'directed', true, nacs);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (`C`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]->(B), (B)-[`bToC`:GRS_Relationship]->(C) WITH * call { WITH * MATCH (`C`:`GRS_Node`) WHERE  C.test = $p_3  RETURN COUNT(*) as nac_matches0 } WITH * WHERE nac_matches0=0 AND B.type = $p_1 AND aToB.type = $p_2 RETURN A, B, C, aToB, bToC',
				{ p_1: 'BType', p_2: 'edge connector', p_3: 'value' }
			);
		});

		test('Match simple pattern with NACs with Node with either/or attribute', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {
						type: 'BType',
					},
				},
				{
					key: 'C',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {
						type: 'edge connector',
					},
				},
				{
					key: 'bToC',
					source: 'B',
					target: 'C',
					attributes: {},
				},
			] as PatternEdgeSchema[];

			const nacs = [
				{
					nodes: [
						{
							key: 'C',
							attributes: {
								test: ['value1', 'value2'],
							},
						},
					],
					edges: [],
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'directed', true, nacs);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (`C`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]->(B), (B)-[`bToC`:GRS_Relationship]->(C) WITH * call { WITH * MATCH (`C`:`GRS_Node`) WHERE  C.test IN $p_3  RETURN COUNT(*) as nac_matches0 } WITH * WHERE nac_matches0=0 AND B.type = $p_1 AND aToB.type = $p_2 RETURN A, B, C, aToB, bToC',
				{ p_1: 'BType', p_2: 'edge connector', p_3: ['value1', 'value2'] }
			);
		});

		test('Match simple pattern with NACs with Edge with either/or attribute', async () => {
			// test case pattern
			const nodes = [
				{
					key: 'A',
					attributes: {},
				},
				{
					key: 'B',
					attributes: {
						type: 'BType',
					},
				},
				{
					key: 'C',
					attributes: {},
				},
			] as PatternNodeSchema[];

			const edges = [
				{
					key: 'aToB',
					source: 'A',
					target: 'B',
					attributes: {
						type: 'edge connector',
					},
				},
				{
					key: 'bToC',
					source: 'B',
					target: 'C',
					attributes: {},
				},
			] as PatternEdgeSchema[];

			const nacs = [
				{
					nodes: [
						{
							key: 'C',
							attributes: {
								test: ['value1', 'value2'],
							},
						},
					],
					edges: [
						{
							key: 'bToC',
							source: 'B',
							target: 'C',
							attributes: {
								test: ['value3', 'value4'],
							},
						},
					],
				},
			];

			const neo4jSpy = vi.spyOn(mockSession, 'executeRead');
			await graphService.findPatternMatch(nodes, edges, 'directed', true, nacs);
			expect(neo4jSpy).toHaveBeenCalled();
			expect(mockTx.run).toHaveBeenCalledWith(
				'MATCH (`A`:`GRS_Node`), (`B`:`GRS_Node`), (`C`:`GRS_Node`), (A)-[`aToB`:GRS_Relationship]->(B), (B)-[`bToC`:GRS_Relationship]->(C) WITH * call { WITH * MATCH (`C`:`GRS_Node`) WITH * MATCH (B)-[`bToC`:GRS_Relationship]-(C) WHERE  C.test IN $p_3 AND  bToC.test IN $p_4  RETURN COUNT(*) as nac_matches0 } WITH * WHERE nac_matches0=0 AND B.type = $p_1 AND aToB.type = $p_2 RETURN A, B, C, aToB, bToC',
				{
					p_1: 'BType',
					p_2: 'edge connector',
					p_3: ['value1', 'value2'],
					p_4: ['value3', 'value4'],
				}
			);
		});
	});
});
