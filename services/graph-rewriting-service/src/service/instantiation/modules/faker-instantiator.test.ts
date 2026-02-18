import { beforeAll, describe, expect, test } from 'vitest';
import { FakerInstantiator, FakerErrors } from './faker-instantiator';
import { faker } from '@faker-js/faker';

describe('Test faker instantiator', () => {
	beforeAll(() => {
		faker.seed(12);
	});

	test('Should return the correct instantiator key', () => {
		const instantiator = new FakerInstantiator();
		expect(instantiator.instantiatorKey).toBe('faker');
	});

	test('Should return value for valid faker module and method', async () => {
		const instantiator = new FakerInstantiator();

		const sets = [
			{
				module: 'string',
				method: 'alpha',
				expectedResult: 'i',
			},
			{
				module: 'number',
				method: 'int',
				expectedResult: 6665775074924851,
			},
			{
				module: 'string',
				method: 'alpha',
				options: { length: { min: 5, max: 10 }, casing: 'upper' },
				expectedResult: 'NAXXAY',
			},
		];

		sets.forEach((testset) => {
			const { module, method, expectedResult, options } = testset;
			// @ts-expect-error: Module is not correctly typed
			const result = instantiator.instantiate({ module, method, options });
			expect(result).toBe(expectedResult);
		});
	});

	test('Should throw error if called with invalid module or method', async () => {
		const instantiator = new FakerInstantiator();

		// @ts-expect-error: Use an invalid module name
		expect(() => instantiator.instantiate({ method: 'test' })).toThrowError(
			FakerErrors.ModuleNotProvided
		);

		// @ts-expect-error: Use an invalid method name
		expect(() => instantiator.instantiate({ module: 'test' })).toThrowError(
			FakerErrors.MethodNotProvided
		);

		expect(() =>
			// @ts-expect-error: Use an invalid module name
			instantiator.instantiate({ module: 'test', method: 'test' })
		).toThrowError(FakerErrors.ModuleNotFound);

		expect(() =>
			instantiator.instantiate({ module: 'string', method: 'test' })
		).toThrowError(FakerErrors.MethodNotFound);
	});
});
