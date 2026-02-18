import { beforeAll, describe, expect, test } from 'vitest';
import { RandexpErrors, RandExpInstantiator } from './randexp-instantiator';
import { faker } from '@faker-js/faker';

describe('Test randexp instantiator', () => {
	beforeAll(() => {
		faker.seed(12);
	});

	test('Should return the correct instantiator key', () => {
		const instantiator = new RandExpInstantiator();
		expect(instantiator.instantiatorKey).toBe('randexp');
	});

	test('Should return value for valid faker module and method', async () => {
		const instantiator = new RandExpInstantiator();

		const sets = [
			{
				pattern: 'hello|world',
				expectedResult: ['hello', 'world'],
			},
			{
				pattern: '(sun|mon|tues|wednes|thurs|fri|satur)day',
				expectedResult: [
					'sunday',
					'monday',
					'tuesday',
					'wednesday',
					'thursday',
					'friday',
					'saturday',
				],
			},
			{
				pattern: 'a|b',
				flags: 'i',
				expectedResult: ['a', 'A', 'b', 'B'],
			},
			{
				pattern: '[1-6]',
				expectedResult: ['1', '2', '3', '4', '5', '6'],
			},
		];

		sets.forEach((testset) => {
			const { pattern, flags, expectedResult } = testset;
			// @ts-expect-error: Module is not correctly typed
			const result = instantiator.instantiate({ pattern, flags });
			expect(expectedResult).toContain(result);
		});
	});

	test('Should throw error if called with invalid arguments', async () => {
		const instantiator = new RandExpInstantiator();

		// @ts-expect-error: Omit mandatory pattern argument
		expect(() => instantiator.instantiate({ flags: 'test' })).toThrowError(
			RandexpErrors.PatternNotProvided
		);
	});
});
