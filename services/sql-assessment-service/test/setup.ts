/**
 * Global test setup executed once before the test suite starts.
 *
 * Responsibilities:
 *  - Export a shared pg-mem factory so individual test files can spin up an
 *    in-memory Postgres instance without boilerplate.
 *
 * Individual test files should import `createTestDb` from the helper directly:
 *
 *   import { createTestDb } from '../helpers/pg-mem-factory';
 *
 * This setup file is loaded by Vitest via the `setupFiles` option in
 * vitest.config.ts.
 *
 * Note: OPENAI_API_KEY is intentionally not stubbed here. The application
 * treats it as optional and falls back to the TemplateTaskDescriptionGenerationEngine
 * when it is absent, so no stub is needed for the test environment.
 */

import { afterAll } from 'vitest';

afterAll(() => {
    // Teardown global resources here if needed.
});

// Re-export the factory so callers can use either import path.
export { createTestDb } from './helpers/pg-mem-factory';
export type { TestDb } from './helpers/pg-mem-factory';
