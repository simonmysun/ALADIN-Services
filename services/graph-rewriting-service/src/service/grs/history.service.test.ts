import { describe, expect, test } from 'vitest';
import { HistoryService } from './history.service';
import { ResultGraphSchema } from './graph-transformation.service';

describe('Test history service', () => {
	test('Correct initialization with empty history', async () => {
		const historyService = new HistoryService();

		expect(historyService.getHistory()).toStrictEqual([]);
	});

	test('Adding to History', async () => {
		const historyService = new HistoryService();

		const firstEntry = {
			options: { type: 'directed' },
			nodes: [],
			edges: [],
		} as ResultGraphSchema;
		historyService.addToHistory(firstEntry);

		expect(historyService.getHistory()).toStrictEqual([firstEntry]);

		const secondEntry = {
			options: { type: 'directed' },
			nodes: [{ key: 'node1', attributes: {} }],
			edges: [],
		} as ResultGraphSchema;

		historyService.addToHistory(secondEntry);

		expect(historyService.getHistory()).toStrictEqual([
			firstEntry,
			secondEntry,
		]);
	});

	test('Clearing history', async () => {
		const historyService = new HistoryService();

		const firstEntry = {
			options: { type: 'directed' },
			nodes: [],
			edges: [],
		} as ResultGraphSchema;
		historyService.addToHistory(firstEntry);

		expect(historyService.getHistory()).toStrictEqual([firstEntry]);

		const secondEntry = {
			options: { type: 'directed' },
			nodes: [{ key: 'node1', attributes: {} }],
			edges: [],
		} as ResultGraphSchema;

		historyService.addToHistory(secondEntry);
		historyService.clearHistory();
		expect(historyService.getHistory()).toStrictEqual([]);
	});
});
