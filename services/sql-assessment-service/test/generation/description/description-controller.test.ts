import { describe, it } from 'vitest';

// Tests for src/generation/description/description-controller.ts
describe('DescriptionController', () => {
    describe('POST /api/description/template', () => {
        it.todo('returns 200 with a description and the requested languageCode');
        it.todo('defaults languageCode to "en" when not provided');
        it.todo('returns 400 when connectionInfo is missing');
        it.todo('returns 400 when query is missing');
        it.todo('returns 400 when the database is not registered');
        it.todo('returns 400 when the SQL query cannot be parsed');
        it.todo('returns 500 when the generation engine throws');
    });

    describe('POST /api/description/llm/default', () => {
        it.todo('returns 200 with a description from the default LLM engine');
        it.todo('returns 400 for invalid connection info');
    });

    describe('POST /api/description/llm/creative', () => {
        it.todo('returns 200 with a description from the creative LLM engine');
    });

    describe('POST /api/description/llm/multi-step', () => {
        it.todo('returns 200 with a description from the multi-step LLM engine');
    });

    describe('POST /api/description/hybrid', () => {
        it.todo('returns 200 with a description from the hybrid engine');
        it.todo('returns 400 when the SQL query cannot be parsed');
    });
});
