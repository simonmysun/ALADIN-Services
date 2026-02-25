/**
 * Global test setup executed once before the test suite starts.
 *
 * Responsibilities:
 *  - Stub environment variables so tests never call real external services.
 *  - Export a shared pg-mem factory so individual test files can spin up an
 *    in-memory Postgres instance without boilerplate.
 *
 * Individual test files should import `createTestDb` from the helper directly:
 *
 *   import { createTestDb } from '../helpers/pg-mem-factory';
 *
 * This setup file is loaded by Vitest via the `setupFiles` option in
 * vitest.config.ts.
 */

import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
    // Prevent any production code that reads OPENAI_API_KEY from hitting the
    // real OpenAI API during tests.
    process.env.OPENAI_API_KEY = 'test-key';
});

afterAll(() => {
    // Teardown global resources here if needed.
});

// Re-export the factory so callers can use either import path.
export { createTestDb } from './helpers/pg-mem-factory';
export type { TestDb } from './helpers/pg-mem-factory';
