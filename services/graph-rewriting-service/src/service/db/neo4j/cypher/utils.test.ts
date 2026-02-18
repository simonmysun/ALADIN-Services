import { expect, test, describe } from 'vitest';
import { sanitizeIdentifier, sanitizeStringLiteral } from './utils';

describe('Test cypher utils', () => {
	test('Test sanitizeStringLiteral', () => {
		const result = sanitizeStringLiteral("apostroph'in'text");
		expect(result).toBe("apostroph\\'in\\'text");

		const result2 = sanitizeStringLiteral(`anfuehrung"in'text`);
		expect(result2).toBe(`anfuehrung\\"in\\'text`);
	});

	test('Test sanitizeIdentifier', () => {
		const result = sanitizeIdentifier('Text`mitHochkomma');

		expect(result).toBe('Text``mitHochkomma');
	});
});
