import { afterEach, describe, expect, test, vi } from 'vitest';

import { InstantiatorService } from './instantiator.service';

describe('Test instantiator manager', () => {
	afterEach(() => {
		vi.clearAllMocks(); // Reset all mocked calls between tests
	});

	test('Throw error for nonexistent instantiator', () => {
		const instantiatorService = new InstantiatorService();
		expect(() =>
			instantiatorService.getGraphInstantiator('NonExistentInstantiator')
		).toThrow('Instantiator of type "NonExistentInstantiator" is not loaded');
	});

	test('Throw an error if the instantiator is not graph instantiator', () => {
		const instantiatorService = new InstantiatorService();
		expect(() => instantiatorService.getGraphInstantiator('randexp')).toThrow(
			'Instantiator of type "randexp" is not a subgraph instantiator'
		);
	});

	test('Throw an error if the instantiator is not a value instantiator', () => {
		const instantiatorService = new InstantiatorService();
		expect(() =>
			instantiatorService.getValueInstantiator('externalApi')
		).toThrow('Instantiator of type "externalApi" is not a value instantiator');
	});

	test('Should return instantiator if it exists & instantiate() should be function', () => {
		const service = new InstantiatorService();
		const instantiator = service.getValueInstantiator('faker');
		expect(instantiator).toBeDefined();
		expect(instantiator.instantiate).toBeInstanceOf(Function);
	});
});
