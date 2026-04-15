import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { DatabaseController } from '../../src/database/database-controller';
import { DatabaseAnalyzer } from '../../src/database/database-analyzer';
import {
	databaseMetadata,
	pgliteInstances,
} from '../../src/database/internal-memory';
import { generatePGliteKey } from '../../src/shared/utils/database-utils';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Minimal two-table schema (public schema — PGlite default) with a FK
 * relationship and a small seed dataset.
 */
const SIMPLE_DDL = `
CREATE TABLE products (
  id   SERIAL PRIMARY KEY,
  name TEXT          NOT NULL,
  price NUMERIC(10,2)
);
CREATE TABLE orders (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  quantity   INTEGER NOT NULL
);
INSERT INTO products (name, price) VALUES ('Widget', 9.99), ('Gadget', 19.99);
INSERT INTO orders  (product_id, quantity) VALUES (1, 5), (2, 3);
`;

const VALID_PGLITE_INFO = {
	type: 'pglite' as const,
	databaseId: 'test-db',
	sqlContent: SIMPLE_DDL,
};

// ---------------------------------------------------------------------------
// Express mock helpers (same pattern as query-execution-controller.test.ts)
// ---------------------------------------------------------------------------

function mockReq(body: unknown): Request {
	return { body } as Request;
}

function mockRes() {
	const json = vi.fn().mockReturnThis();
	const status = vi.fn().mockReturnValue({ json });
	return { res: { status, json } as unknown as Response, status, json };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DatabaseController — PGlite path', () => {
	let controller: DatabaseController;

	beforeEach(() => {
		controller = new DatabaseController(new DatabaseAnalyzer());
		databaseMetadata.clear();
		pgliteInstances.clear();
	});

	afterEach(async () => {
		// Close any open PGlite instances to avoid resource leaks.
		for (const db of pgliteInstances.values()) {
			await db?.close?.();
		}
		pgliteInstances.clear();
		databaseMetadata.clear();
	});

	// -----------------------------------------------------------------------
	// Request validation
	// -----------------------------------------------------------------------

	describe('analyzeDatabase — PGlite request validation', () => {
		it('returns 400 when databaseId is missing', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: { type: 'pglite', sqlContent: SIMPLE_DDL } }),
				res,
			);
			expect(status).toHaveBeenCalledWith(400);
		});

		it('returns 400 when sqlContent is missing', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: { type: 'pglite', databaseId: 'test-db' } }),
				res,
			);
			expect(status).toHaveBeenCalledWith(400);
		});

		it('returns 400 when sqlContent is not a string', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({
					connectionInfo: {
						type: 'pglite',
						databaseId: 'test-db',
						sqlContent: 42,
					},
				}),
				res,
			);
			expect(status).toHaveBeenCalledWith(400);
		});

		it('returns 400 when sqlContent is an empty string', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({
					connectionInfo: {
						type: 'pglite',
						databaseId: 'test-db',
						sqlContent: '',
					},
				}),
				res,
			);
			expect(status).toHaveBeenCalledWith(400);
		});

		it('returns 400 when databaseId is not a string', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({
					connectionInfo: {
						type: 'pglite',
						databaseId: 123,
						sqlContent: SIMPLE_DDL,
					},
				}),
				res,
			);
			expect(status).toHaveBeenCalledWith(400);
		});
	});

	// -----------------------------------------------------------------------
	// Integration (real PGlite)
	// -----------------------------------------------------------------------

	describe('analyzeDatabase — PGlite integration', () => {
		it('returns 200 for valid DDL', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: VALID_PGLITE_INFO }),
				res,
			);
			expect(status).toHaveBeenCalledWith(200);
		});

		it('registers database metadata under the PGlite key', async () => {
			const { res } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: VALID_PGLITE_INFO }),
				res,
			);
			expect(databaseMetadata.has(generatePGliteKey('test-db'))).toBe(true);
		});

		it('reflects table names into metadata', async () => {
			const { res } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: VALID_PGLITE_INFO }),
				res,
			);
			const tables = databaseMetadata.get(generatePGliteKey('test-db'));
			const names = tables!.map((t) => t.name);
			expect(names).toContain('products');
			expect(names).toContain('orders');
		});

		it('stores the PGlite instance for later query execution', async () => {
			const { res } = mockRes();
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: VALID_PGLITE_INFO }),
				res,
			);
			expect(pgliteInstances.has('test-db')).toBe(true);
		});

		it('returns 500 when sqlContent contains invalid SQL', async () => {
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({
					connectionInfo: {
						type: 'pglite',
						databaseId: 'bad-db',
						sqlContent: 'THIS IS NOT VALID SQL AT ALL !!!',
					},
				}),
				res,
			);
			expect(status).toHaveBeenCalledWith(500);
		});

		it('replaces an existing PGlite instance when databaseId is reused', async () => {
			// First call — products + orders schema
			await controller.analyzeDatabase(
				mockReq({ connectionInfo: VALID_PGLITE_INFO }),
				mockRes().res,
			);
			const firstInstance = pgliteInstances.get('test-db');

			// Second call — completely different schema, same databaseId
			const { res, status } = mockRes();
			await controller.analyzeDatabase(
				mockReq({
					connectionInfo: {
						type: 'pglite',
						databaseId: 'test-db',
						sqlContent:
							'CREATE TABLE categories (id SERIAL PRIMARY KEY, label TEXT NOT NULL);',
					},
				}),
				res,
			);

			expect(status).toHaveBeenCalledWith(200);
			const tables = databaseMetadata.get(generatePGliteKey('test-db'));
			expect(tables!.map((t) => t.name)).toContain('categories');
			expect(tables!.map((t) => t.name)).not.toContain('products');
			// A new PGlite instance must replace the old one
			expect(pgliteInstances.get('test-db')).not.toBe(firstInstance);
		});
	});
});
