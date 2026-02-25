import { describe, it } from 'vitest';

// Tests for src/generation/description/llm-task-description-generation-engine.ts
describe('LLMTaskDescriptionGenerationEngine', () => {
    describe('generateTaskFromQuery (default)', () => {
        it.todo('returns a string description when the LLM responds successfully');
        it.todo('throws when the database key is not registered in metadata');
    });

    describe('generateTaskFromQuery (creative)', () => {
        it.todo('uses the high-temperature model instance');
    });

    describe('generateTaskFromQuery (multi-step)', () => {
        it.todo('executes three chained pipeline steps');
        it.todo('passes clause-split SQL to the second step');
    });

    describe('generateNLGTaskFromTemplateTask', () => {
        it.todo('post-processes a template description into fluent prose');
    });

    describe('splitSQLQuery', () => {
        it.todo('splits a SELECT query into its individual clauses');
        it.todo('handles a query with no WHERE clause');
    });
});
