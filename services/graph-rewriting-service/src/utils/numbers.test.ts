import { expect, test, describe } from 'vitest';
import { getRandomIntBetween } from './numbers';

describe('Test numbers helpers', () => {
	test('Test random number between should be greater than min and smaller than max', () => {
		const randomNumber = getRandomIntBetween(3, 10);

		expect(randomNumber).toBeLessThanOrEqual(10);
		expect(randomNumber).toBeGreaterThanOrEqual(3);
	});
});
